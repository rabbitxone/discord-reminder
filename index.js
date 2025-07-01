const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const { token } = require('./config.json');
const chrono = require('chrono-node');
const { parseDate } = require('./dateParser');

const { DateTimeFormat, SupportedValuesOf } = Intl;
const timezones = Intl.supportedValuesOf('timeZone').map(tz => ({ name: tz, value: tz }));

const db = new sqlite3.Database('./reminders.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            message TEXT NOT NULL,
            remind_at DATETIME NOT NULL,
            channel TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sent BOOLEAN DEFAULT 0
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS usertimezones (
            user_id TEXT NOT NULL PRIMARY KEY,
            timezone TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });
    }
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if(interaction.isAutocomplete()) {
        try {
            const focusedOption = interaction.options.getFocused(true);
            if(focusedOption.name === 'timezone') {
                const query = focusedOption.value.toLowerCase();
                const filteredTimezones = timezones.filter(tz => tz.name.toLowerCase().includes(query));
                const choices = filteredTimezones.slice(0, 25);
                await interaction.respond(choices);
            } else if(focusedOption.name === 'name') {
                // Message of the user's reminder that is going to be deleted
                const userId = interaction.user.id;
                const query = focusedOption.value.toLowerCase();
                db.all(`SELECT message, remind_at FROM reminders WHERE user_id = ? AND message LIKE ?`, [userId, `%${query}%`], async (err, rows) => {
                    if (err) {
                        console.error('Error fetching reminders:', err.message);
                        return interaction.respond([]);
                    }
                    
                    const pluralize = (number, form1, form2, form5) => {
                        if (number === 1) {
                            return form1;
                        } else if (number % 10 >= 2 && number % 10 <= 4 && (number % 100 < 10 || number % 100 >= 20)) {
                            return form2;
                        } else {
                            return form5;
                        }
                    };

                    const choices = rows.map(row => {
                        const remindAt = new Date(row.remind_at);
                        const now = new Date();
                        const diff = Math.abs(remindAt - now);
                        const totalMinutes = Math.floor(diff / (1000 * 60));
                        
                        let timeString = '';
                        if (interaction.locale.startsWith('pl')) {
                            const days = Math.floor(totalMinutes / 1440);
                            const remainingMinutes = totalMinutes % 1440;
                            const hours = Math.floor(remainingMinutes / 60);
                            const minutes = remainingMinutes % 60;

                            if (days > 0) timeString += `${days} ${pluralize(days, "dzień", "dni", "dni")} `;
                            if (hours > 0) timeString += `${hours} ${pluralize(hours, "godzina", "godziny", "godzin")} `;
                            if (minutes > 0) timeString += `${minutes} ${pluralize(minutes, "minuta", "minuty", "minut")}`;
                            timeString = `za ${timeString.trim()}`;
                        } else {
                            const days = Math.floor(totalMinutes / 1440);
                            const remainingMinutes = totalMinutes % 1440;
                            const hours = Math.floor(remainingMinutes / 60);
                            const minutes = remainingMinutes % 60;

                            if (days > 0) timeString += `${days} day${days > 1 ? 's' : ''} `;
                            if (hours > 0) timeString += `${hours} hour${hours > 1 ? 's' : ''} `;
                            if (minutes > 0) timeString += `${minutes} minute${minutes > 1 ? 's' : ''}`;
                            timeString = `in ${timeString.trim()}`;
                        }

                        return { name: `${row.message} (${timeString})`, value: row.id.toString() };
                    });

                    await interaction.respond(choices.slice(0, 25));
                });
            }
        } catch (err) {
            console.error('Autocomplete interaction error:', err);
        }
        return;
    }

    if(!interaction.isCommand()) return;

    const { commandName } = interaction;
    if(commandName === 'remind') {
        await interaction.deferReply({ flags: 1 << 6 });

        const message = interaction.options.getString('message');
        const when = interaction.options.getString('when');
        const userId = interaction.user.id;
        const locale = interaction.locale.startsWith('pl') ? 'pl' : 'en';
        const channel = interaction.options.getString('dm') === 'true' ? interaction.user : interaction.channel;

        // Get user's timezone from DB
        db.get(
            `SELECT timezone FROM usertimezones WHERE user_id = ?`,
            [userId],
            async (err, row) => {

            let userTimezone = 'UTC';
            let usedDefaultTimezone = false;
            if (row && row.timezone) {
                userTimezone = row.timezone;
            } else {
                usedDefaultTimezone = true;
            }

            let remindAt;
            if(locale === 'pl') remindAt = parseDate(when);
            else remindAt = chrono.en.parseDate(when);

            if (!remindAt) {
                if(locale === 'pl') {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle('❌ Błąd w przetwarzaniu daty')
                            .setDescription('Nie udało się poprawnie odczytać podanej daty. Spróbuj ponownie używając innych wyrazów lub podając dokładną datę i godzinę.')
                    ]
                    await interaction.reply({ embeds: embed });
                } else {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle('❌ Error processing date')
                            .setDescription('Failed to parse the provided date. Please try again using different words or by specifying the exact date and time.')
                    ]
                    await interaction.reply({ embeds: embed });
                }
                return;
            }

            const userDate = new Date(
                remindAt.toLocaleString('en-US', { timeZone: userTimezone })
            );
            console.log('remindAt:', remindAt, '//', userTimezone, '=>', userDate);

            const timestamp = Math.floor(userDate.getTime() / 1000); // Unix timestamp
            const query = `INSERT INTO reminders (user_id, message, remind_at, channel) VALUES (?, ?, ?, ?)`;
            db.run(query, [userId, message, userDate.toISOString(), channel], async function (err) {
                if (err) {
                    console.error('Error inserting reminder:', err.message);
                    
                    if(locale === 'pl') {
                        const embed = [
                            new EmbedBuilder()
                                .setColor(15277667)
                                .setTitle('❌ Nie udało się zapisać przypomnienia')
                                .setDescription('Zapisywanie przypomnienia nie powiodło się. Być może wystąpił błąd komunikacji z bazą danych. Spróbuj ponownie później.')
                        ]
                        await interaction.reply({ embeds: embed });
                    } else {
                        const embed = [
                            new EmbedBuilder()
                                .setColor(15277667)
                                .setTitle('❌ Failed to save the reminder')
                                .setDescription('Saving reminder hasn\'t completed successfully. There might be a database connection issue. Please try again later.')
                        ]
                        await interaction.reply({ embeds: embed });
                    }
                } else {
                    let title, description, warning;
                    if(locale === 'pl') {
                        title = `✅ Przypomnienie zapisane`;
                        description = `Przypomnę Ci ${userDate.toLocaleString('pl-PL', { timeZone: userTimezone })}`;
                        if (usedDefaultTimezone) {
                            warning = `:warning: Użyto domyślnej strefy czasowej, \`UTC\`. Aby ustawić własną strefę czasową, użyj komendy \`/settimezone\`.`;
                        }
                    } else {
                        title = `✅ Reminder saved`;
                        description = `I'll remind you on <t:${timestamp}>`;
                        if (usedDefaultTimezone) {
                            warning = `\n:warning: Used default timezone, \`UTC\`. To set your own timezone, use the \`/settimezone\` command.`;
                        }
                    }

                    const embed = [
                        new EmbedBuilder()
                            .setColor(1752220)
                            .setTitle(title)
                            .setDescription(description)
                    ];
                    if (warning) {
                        embed[0].setFooter({ text: warning });
                    }

                    await interaction.editReply({ embeds: embed });
                }
            });
        });

    } else if(commandName === 'deletereminder') {
        await interaction.deferReply({ flags: 1 << 6 });

        const reminderId = interaction.options.getString('name');
        const userId = interaction.user.id;
        const locale = interaction.locale && interaction.locale.startsWith('pl') ? 'pl' : 'en';

        db.run(`DELETE FROM reminders WHERE id = ? AND user_id = ?`, [reminderId, userId], async function(err) {
            if (err) {
                console.error('Error deleting reminder:', err.message);
                if(locale === 'pl') {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle('❌ Nie udało się usunąć przypomnienia')
                            .setDescription('Usuwanie przypomnienia nie powiodło się. Być może wystąpił problem z połączeniem z bazą danych. Spróbuj ponownie później.')
                    ]
                    await interaction.editReply({ embeds: embed });
                } else { 
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle('❌ Failed to delete reminder')
                            .setDescription('Deleting reminder hasn\'t completed successfully. There might be a database connection issue. Please try again later.')
                    ]
                    await interaction.editReply({ embeds: embed });
                }
            } else if (this.changes === 0) {
                if(locale === 'pl') {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle('❌ Nie udało się usunąć przypomnienia')
                            .setDescription('Nie znaleziono przypomnienia o podanej nazwie. Upewnij się, że podana nazwa przypomnienia jest poprawna.')
                    ]
                    await interaction.editReply({ embeds: embed });
                } else {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle('❌ Failed to delete reminder')
                            .setDescription('No reminder found with the provided name. Please ensure that the reminder name is correct.')
                    ]
                    await interaction.editReply({ embeds: embed });
                }
            } else {
                if(locale === 'pl') {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(1752220)
                            .setTitle('✅ Przypomnienie usunięte')
                    ]
                    await interaction.editReply({ embeds: embed });
                } else {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(1752220)
                            .setTitle('✅ Reminder deleted')
                    ]
                    await interaction.editReply({ embeds: embed });
                }
            }
        });

    } else if(commandName === 'settimezone') {
        await interaction.deferReply({ flags: 1 << 6 });

        const timezone = interaction.options.getString('timezone');
        const userId = interaction.user.id;
        const locale = interaction.locale && interaction.locale.startsWith('pl') ? 'pl' : 'en';

        // Check if the timezone is valid
        const isValidTimezone = timezones.some(tz => tz.value === timezone);
        if (!isValidTimezone) {
            if(locale === 'pl') {
                const embed = [
                    new EmbedBuilder()
                        .setColor(15277667)
                        .setTitle('❌ Nieprawidłowa strefa czasowa')
                        .setDescription('Podana strefa czasowa jest nieprawidłowa. Użyj komendy `/settimezone` i wybierz jedną z dostępnych stref czasowych.')
                ];
                await interaction.editReply({ embeds: embed });
            } else {
                const embed = [
                    new EmbedBuilder()
                        .setColor(15277667)
                        .setTitle('❌ Invalid timezone')
                        .setDescription('The provided timezone is invalid. Use the `/settimezone` command and select one of the available timezones.')
                ];
                await interaction.editReply({ embeds: embed });
            };
            return;
        }

        const query = `INSERT OR REPLACE INTO usertimezones (user_id, timezone) VALUES (?, ?)`;
        db.run(query, [userId, timezone], async function(err) {
            if (err) {
                console.error('Error inserting timezone:', err.message);
                if(locale === 'pl') {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle('❌ Błąd zapisu strefy czasowej')
                            .setDescription('Zapisywanie strefy czasowej nie powiodło się. Być może wystąpił błąd komunikacji z bazą danych. Spróbuj ponownie później.')
                    ];
                    await interaction.editReply({ embeds: embed });
                } else {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle('❌ Error saving timezone')
                            .setDescription('Saving timezone hasn\'t completed successfully. There might be a database connection issue. Please try again later.')
                    ];
                    await interaction.editReply({ embeds: embed });
                }
            } else {
                if(locale === 'pl') {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(1752220)
                            .setTitle('✅ Strefa czasowa ustawiona')
                            .setDescription(`Twoja strefa czasowa została ustawiona na **${timezone}**. Nowe przypomnienia będą teraz wysyłane zgodnie z tą strefą czasową, jednak ta zmiana nie wpłynie na już utworzone przypomnienia.`)
                    ];
                    await interaction.editReply({ embeds: embed });
                } else {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(1752220)
                            .setTitle('✅ Timezone set')
                            .setDescription(`Your timezone has been set to **${timezone}**. New reminders will now be sent according to this timezone, however, this change will not affect already created reminders.`)
                    ];
                    await interaction.editReply({ embeds: embed });
                }
            }
        });
    }
});

process.on('exit', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
    });
});

client.login(token);
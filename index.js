const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const { token } = require('./config.json');
const chrono = require('chrono-node');
const { parseDate } = require('./dateParser');
const cron = require('node-cron');

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
    if (interaction.isAutocomplete()) {
        try {
            const focusedOption = interaction.options.getFocused(true);
            if (focusedOption.name === 'timezone') {
                const query = focusedOption.value.toLowerCase();
                const filteredTimezones = timezones.filter(tz => tz.name.toLowerCase().includes(query));
                const choices = filteredTimezones.slice(0, 25);
                await interaction.respond(choices);
            } else if (focusedOption.name === 'name') {
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

    if (interaction.isButton()) {
        const customId = interaction.customId;
        if (customId.startsWith('reminders_prev_') || customId.startsWith('reminders_next_')) {
            const userId = interaction.user.id;
            const locale = interaction.locale && interaction.locale.startsWith('pl') ? 'pl' : 'en';

            // Extract page number from customId
            const page = parseInt(customId.split('_')[2], 10);

            // Fetch reminders from the database
            db.all(`SELECT id, message, remind_at, channel, created_at, sent FROM reminders WHERE user_id = ?`, [userId], async (err, rows) => {
                if (err) {
                    console.error('Error fetching reminders:', err.message);
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle(locale === 'pl' ? '❌ Błąd pobierania przypomnień' : '❌ Error fetching reminders')
                            .setDescription(locale === 'pl' ? 'Nie udało się pobrać listy przypomnień. Spróbuj ponownie później.' : 'Failed to fetch the reminders list. Please try again later.')
                    ];
                    await interaction.reply({ embeds: embed, ephemeral: true });
                    return;
                }

                const remindersPerPage = 5;
                const totalPages = Math.ceil(rows.length / remindersPerPage);

                if (page < 1 || page > totalPages) {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle(locale === 'pl' ? '❌ Nieprawidłowa strona' : '❌ Invalid page')
                            .setDescription(locale === 'pl' ? 'Podano nieprawidłowy numer strony.' : 'Invalid page number provided.')
                    ];
                    await interaction.reply({ embeds: embed, ephemeral: true });
                    return;
                }

                const startIndex = (page - 1) * remindersPerPage;
                const endIndex = startIndex + remindersPerPage;
                const remindersToShow = rows.slice(startIndex, endIndex);

                const embed = new EmbedBuilder()
                    .setColor(1752220)
                    .setTitle(locale === 'pl' ? '📋 Lista przypomnień' : '📋 Reminders list')
                    .setFooter({
                        text: locale === 'pl'
                            ? `Strona ${page} z ${totalPages}`
                            : `Page ${page} of ${totalPages}`
                    });

                remindersToShow.forEach(reminder => {
                    const remindAtTimestamp = Math.floor(new Date(reminder.remind_at).getTime() / 1000);
                    const createdAtTimestamp = Math.floor(new Date(reminder.created_at).getTime() / 1000);
                    const sentStatus = reminder.sent
                        ? locale === 'pl' ? '✅ Wysłane' : '✅ Sent'
                        : locale === 'pl' ? '⌚ Oczekujące' : '⌚ Pending';

                    embed.addFields({
                        name: reminder.message,
                        value: `${locale === 'pl' ? 'Data przypomnienia' : 'Reminder date'}: <t:${remindAtTimestamp}> (<t:${remindAtTimestamp}:R>)\n` +
                            `${locale === 'pl' ? 'Data utworzenia' : 'Created at'}: <t:${createdAtTimestamp}>\n` +
                            `${locale === 'pl' ? 'Kanał' : 'Channel'}: ${reminder.channel.startsWith('U') ? `<@${reminder.channel.replace('U', '')}>` : `<#${reminder.channel}>`}`,
                    });
                });

                const components = [];
                if (totalPages > 1) {
                    components.push(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`reminders_prev_${page - 1}`)
                                .setLabel(locale === 'pl' ? 'Poprzednia' : 'Previous')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(page === 1),
                            new ButtonBuilder()
                                .setCustomId(`reminders_next_${page + 1}`)
                                .setLabel(locale === 'pl' ? 'Następna' : 'Next')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(page === totalPages)
                        )
                    );
                }

                await interaction.update({ embeds: [embed], components });
            });
        }
    }

    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    if (commandName === 'remind') {
        await interaction.deferReply({ flags: 1 << 6 });

        const message = interaction.options.getString('message');
        const when = interaction.options.getString('when');
        const userId = interaction.user.id;
        const locale = interaction.locale.startsWith('pl') ? 'pl' : 'en';
        const channel = interaction.options.getString('dm') === 'true' ? 'U' + interaction.user.id : interaction.channel.id;
        console.log(channel);

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
                if (locale === 'pl') remindAt = parseDate(when);
                else remindAt = chrono.en.parseDate(when);

                if (!remindAt) {
                    if (locale === 'pl') {
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

                        if (locale === 'pl') {
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
                        if (locale === 'pl') {
                            title = `✅ Przypomnienie zapisane`;
                            description = `Przypomnę Ci ${userDate.toLocaleString('pl-PL', { timeZone: userTimezone })}`;
                            if (usedDefaultTimezone) {
                                warning = "⚠ Użyto domyślnej strefy czasowej, `UTC`. Aby ustawić własną strefę czasową, użyj komendy `/settimezone`.";
                            }
                        } else {
                            title = `✅ Reminder saved`;
                            description = `I'll remind you on <t:${timestamp}>`;
                            if (usedDefaultTimezone) {
                                warning = "⚠ Used default timezone, `UTC`. To set your own timezone, use the `/settimezone` command.";
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

    } else if (commandName === 'deletereminder') {
        await interaction.deferReply({ flags: 1 << 6 });

        const reminderId = interaction.options.getString('name');
        const userId = interaction.user.id;
        const locale = interaction.locale && interaction.locale.startsWith('pl') ? 'pl' : 'en';

        db.run(`DELETE FROM reminders WHERE id = ? AND user_id = ?`, [reminderId, userId], async function (err) {
            if (err) {
                console.error('Error deleting reminder:', err.message);
                if (locale === 'pl') {
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
                if (locale === 'pl') {
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
                if (locale === 'pl') {
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

    } else if (commandName === 'reminders') {

        await interaction.deferReply({ flags: 1 << 6 });

        const userId = interaction.user.id;
        const locale = interaction.locale && interaction.locale.startsWith('pl') ? 'pl' : 'en';
        // Get reminders list for the user from db
        db.all(`SELECT id, message, remind_at, channel, created_at, sent FROM reminders WHERE user_id = ?`, [userId], async (err, rows) => {
            if (err) {
                console.error('Error fetching reminders:', err.message);
                if (locale === 'pl') {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle('❌ Błąd pobierania przypomnień')
                            .setDescription('Nie udało się pobrać listy przypomnień. Być może wystąpił błąd komunikacji z bazą danych. Spróbuj ponownie później.')
                    ];
                    await interaction.editReply({ embeds: embed });
                } else {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(15277667)
                            .setTitle('❌ Error fetching reminders')
                            .setDescription('Failed to fetch the reminders list. There might be a database connection issue. Please try again later.')
                    ];
                    await interaction.editReply({ embeds: embed });
                }
                return;
            }

            if (rows.length === 0) {
                if (locale === 'pl') {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(1752220)
                            .setTitle('📋 Lista przypomnień')
                            .setDescription('Nie masz żadnych przypomnień. Użyj komendy `/remind` aby dodać nowe przypomnienie.')
                    ];
                    await interaction.editReply({ embeds: embed });
                } else {
                    const embed = [
                        new EmbedBuilder()
                            .setColor(1752220)
                            .setTitle('📋 Reminders list')
                            .setDescription('You have no reminders. Use the `/remind` command to add a new reminder.')
                    ];
                    await interaction.editReply({ embeds: embed });
                }
                return;
            }

            const remindersPerPage = 5;
            const totalPages = Math.ceil(rows.length / remindersPerPage);
            const page = interaction.customId ? parseInt(interaction.customId.split('_')[2], 10) : 1;

            if (page < 1 || page > totalPages) {
                const embed = [
                    new EmbedBuilder()
                        .setColor(15277667)
                        .setTitle(locale === 'pl' ? '❌ Nieprawidłowa strona' : '❌ Invalid page')
                        .setDescription(locale === 'pl' ? 'Podano nieprawidłowy numer strony.' : 'Invalid page number provided.')
                ];
                await interaction.editReply({ embeds: embed });
                return;
            }

            const startIndex = (page - 1) * remindersPerPage;
            const endIndex = startIndex + remindersPerPage;
            const remindersToShow = rows.slice(startIndex, endIndex);

            const embed = new EmbedBuilder()
                .setColor(1752220)
                .setTitle(locale === 'pl' ? '📋 Lista przypomnień' : '📋 Reminders list')
                .setFooter({
                    text: locale === 'pl'
                        ? `Strona ${page} z ${totalPages}`
                        : `Page ${page} of ${totalPages}`
                });

            remindersToShow.forEach(reminder => {
                const remindAtTimestamp = Math.floor(new Date(reminder.remind_at).getTime() / 1000);
                const createdAtTimestamp = Math.floor(new Date(reminder.created_at).getTime() / 1000);
                const sentStatus = reminder.sent
                    ? locale === 'pl' ? '✅ Wysłane' : '✅ Sent'
                    : locale === 'pl' ? '⌚ Oczekujące' : '⌚ Pending';

                embed.addFields({
                    name: reminder.message,
                    value: `${locale === 'pl' ? 'Data przypomnienia' : 'Reminder date'}: <t:${remindAtTimestamp}> (<t:${remindAtTimestamp}:R>)\n` +
                        `${locale === 'pl' ? 'Data utworzenia' : 'Created at'}: <t:${createdAtTimestamp}>\n` +
                        `${locale === 'pl' ? 'Kanał' : 'Channel'}: ${reminder.channel.startsWith('U') ? `<@${reminder.channel.replace('U', '')}>` : `<#${reminder.channel}>`}`,
                });
            });

            const components = [];
            if (totalPages > 1) {
                components.push(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`reminders_prev_${page - 1}`)
                            .setLabel(locale === 'pl' ? 'Poprzednia' : 'Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === 1),
                        new ButtonBuilder()
                            .setCustomId(`reminders_next_${page + 1}`)
                            .setLabel(locale === 'pl' ? 'Następna' : 'Next')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === totalPages)
                    )
                );
            }

            await interaction.editReply({ embeds: [embed], components });
            
        });

    } else if (commandName === 'settimezone') {
        await interaction.deferReply({ flags: 1 << 6 });

        const timezone = interaction.options.getString('timezone');
        const userId = interaction.user.id;
        const locale = interaction.locale && interaction.locale.startsWith('pl') ? 'pl' : 'en';

        // Check if the timezone is valid
        const isValidTimezone = timezones.some(tz => tz.value === timezone);
        if (!isValidTimezone) {
            if (locale === 'pl') {
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
        db.run(query, [userId, timezone], async function (err) {
            if (err) {
                console.error('Error inserting timezone:', err.message);
                if (locale === 'pl') {
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
                if (locale === 'pl') {
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

// For test purposes, send a message to the channel when the bot is ready
// client.once('ready', () => {
//     client.channels.fetch('764071979854069800')
//         .then(channel => {
//             if (channel.isTextBased()) {
//                 channel.send('Hello!')
//                     .then(message => {
//                         setTimeout(() => {
//                             message.delete().catch(err => console.error('Error deleting message:', err.message));
//                         }, 10000); // Delete the message after 10 seconds
//                     });
//             }
//         })
//         .catch(err => console.error('Error fetching channel:', err.message));
// });

// For test purposes, send a message to the user's DM when the bot is ready
// client.once('ready', () => {
//     const userId = '764071979854069800'; // Replace with the actual user ID
//     client.users.fetch(userId)
//         .then(user => {
//             user.send('Hello!')
//                 .then(message => {
//                     setTimeout(() => {
//                         message.delete().catch(err => console.error('Error deleting message:', err.message));
//                     }, 10000); // Delete the message after 10 seconds
//                 });
//         })
//         .catch(err => console.error('Error fetching user:', err.message));
// });

cron.schedule('*/1 * * * *', () => {
    const now = new Date();
    db.all(`SELECT * FROM reminders WHERE sent = 0 AND remind_at <= ?`, [now.toISOString()], (err, rows) => {
        if (err) {
            console.error('Error fetching reminders:', err.message);
            return;
        }

        rows.forEach(reminder => {
            if (reminder.channel.startsWith('U')) {
            // Send a DM to the user
            const userId = reminder.channel.replace('U', '');
            client.users.fetch(userId)
                .then(user => {
                user.send(`🔔 Reminder: ${reminder.message}`)
                    .then(() => {
                    db.run(`UPDATE reminders SET sent = 1 WHERE id = ?`, [reminder.id], (err) => {
                        if (err) {
                        console.error('Error updating reminder:', err.message);
                        }
                    });
                    })
                    .catch(err => console.error('Error sending reminder DM:', err.message));
                })
                .catch(err => console.error('Error fetching user for reminder:', err.message));
            } else {
            // Send a message to the channel
            client.channels.fetch(reminder.channel)
                .then(channel => {
                if (channel.isTextBased()) {
                    channel.send(`🔔 Reminder: ${reminder.message} <@${reminder.user_id}>`)
                    .then(() => {
                        db.run(`UPDATE reminders SET sent = 1 WHERE id = ?`, [reminder.id], (err) => {
                        if (err) {
                            console.error('Error updating reminder:', err.message);
                        }
                        });
                    })
                    .catch(err => console.error('Error sending reminder message:', err.message));
                } else {
                    console.error(`Channel not text-based for reminder ID ${reminder.id}`);
                }
                })
                .catch(err => console.error('Error fetching channel for reminder:', err.message));
            }
        });
    });
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
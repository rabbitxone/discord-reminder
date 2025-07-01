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
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
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

// Function to save reminder
// function saveReminder(message, remindAt) {
//     const query = `INSERT INTO reminders (message, remind_at) VALUES (?, ?)`;
//     db.run(query, [message, remindAt], function(err) {
//         if (err) {
//             console.error('Error inserting reminder:', err.message);
//         } else {
//             console.log(`Reminder saved with ID: ${this.lastID}`);
//         }
//     });
// }

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if(interaction.isAutocomplete()) {
        const focusedOption = interaction.options.getFocused(true);
        if(focusedOption.name === 'timezone') {
            const query = focusedOption.value.toLowerCase();
            const filteredTimezones = timezones.filter(tz => tz.name.toLowerCase().includes(query));
            const choices = filteredTimezones.slice(0, 25);
            await interaction.respond(choices);
        }
        return;
    }

    if(!interaction.isCommand()) return;

    const { commandName } = interaction;
    if(commandName === 'remind') {

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
                if(locale === 'pl') await interaction.reply({ content: 'Nie udało się poprawnie odczytać podanej daty. Spróbuj ponownie używając innych wyrazów lub podając dokładną datę i godzinę.', flags: 1 << 6 });
                else await interaction.reply({ content: 'Failed to parse the date. Please try again with different words or by providing an exact date and time.', flags: 1 << 6 });
                return;
            }

            const utcDate = new Date(remindAt.getTime() - remindAt.getTimezoneOffset() * 60000);
            const userDateStr = utcDate.toLocaleString('en-US', { timeZone: userTimezone });
            const userDate = new Date(userDateStr);

            const timestamp = Math.floor(userDate.getTime() / 1000); // Unix timestamp
            const query = `INSERT INTO reminders (user_id, message, remind_at, channel) VALUES (?, ?, ?, ?)`;
            db.run(query, [userId, message, userDate.toISOString(), channel], function (err) {
                if (err) {
                console.error('Error inserting reminder:', err.message);
                if(locale === 'pl') interaction.reply({ content: 'Nie udało się zapisać przypomnienia. Spróbuj ponownie później.', flags: 1 << 6 });
                else interaction.reply({ content: 'Failed to save the reminder. Please try again later.', flags: 1 << 6 });
                } else {
                let replyMsg;
                if(locale === 'pl') {
                    replyMsg = `Przypomnienie zapisane! Przypomnę Ci o ${userDate.toLocaleString('pl-PL', { timeZone: userTimezone })} (${userTimezone}).`;
                    if (usedDefaultTimezone) {
                    replyMsg += `\n:warning: Użyto domyślnej strefy czasowej, \`UTC\`. Aby ustawić własną strefę czasową, użyj komendy \`/settimezone\`.`;
                    }
                } else {
                    replyMsg = `Reminder saved! I'll remind you on <t:${timestamp}> (${userTimezone}).`;
                    if (usedDefaultTimezone) {
                    replyMsg += `\n:warning: Used default timezone, \`UTC\`. To set your own timezone, use the \`/settimezone\` command.`;
                    }
                }
                interaction.reply({ content: replyMsg, flags: 1 << 6 });
                }
            });
        });

    } else if(commandName === 'settimezone') {
        const timezone = interaction.options.getString('timezone');
        const userId = interaction.user.id;
        const locale = interaction.locale && interaction.locale.startsWith('pl') ? 'pl' : 'en';

        // Check if the timezone is valid
        const isValidTimezone = timezones.some(tz => tz.value === timezone);
        if (!isValidTimezone) {
            if(locale === 'pl') await interaction.reply({ content: 'Nieprawidłowa strefa czasowa. Wybierz jedną z dostępnych stref.', flags: 1 << 6 });
            else await interaction.reply({ content: 'Invalid timezone. Please choose a valid timezone.', flags: 1 << 6 });
            return;
        }

        const query = `INSERT OR REPLACE INTO usertimezones (user_id, timezone) VALUES (?, ?)`;
        db.run(query, [userId, timezone], async function(err) {
            if (err) {
                console.error('Error inserting timezone:', err.message);
                if(locale === 'pl') await interaction.reply({ content: 'Nie udało się zapisać twojej strefy czasowej. Spróbuj ponownie później.', flags: 1 << 6 });
                else await interaction.reply({ content: 'Failed to save your timezone. Please try again later.', flags: 1 << 6 });
            } else {
                if(locale === 'pl') await interaction.reply({ content: `Twoja strefa czasowa została ustawiona na ${timezone}.`, flags: 1 << 6 });
                else await interaction.reply({ content: `Your timezone has been set to ${timezone}.`, flags: 1 << 6 });
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
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const { token } = require('./config.json');
const chrono = require('chrono-node');
const { parseDate } = require('./dateParser');

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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sent BOOLEAN DEFAULT 0
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
    if(!interaction.isCommand()) return;

    const { commandName } = interaction;
    if(commandName = 'remind') {

        const message = interaction.options.getString('message');
        const when = interaction.options.getString('when');
        const userId = interaction.user.id;

        // function parseDate(input, locale) {
        //     const parser = locale === 'pl' ? chrono.pl : chrono.en;
        //     return parser.parseDate(input);
        // }
        // Unfortunately, chrono-node doesn't support Polish
        return;

        const locale = interaction.locale.startsWith('pl') ? 'pl' : 'en';
        const remindAt = parseDate(when, locale);

        if (!remindAt) {
            await interaction.reply({ content: 'Could not parse the date/time. Please try again.', ephemeral: true });
            return;
        }

        const query = `INSERT INTO reminders (user_id, message, remind_at) VALUES (?, ?, ?)`;
        db.run(query, [userId, message, remindAt.toISOString()], function (err) {
            if (err) {
                console.error('Error inserting reminder:', err.message);
                interaction.reply({ content: 'Failed to save the reminder. Please try again later.', ephemeral: true });
            } else {
                interaction.reply({ content: `Reminder saved! I'll remind you on ${remindAt}.`, ephemeral: true });
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
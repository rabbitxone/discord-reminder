const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./config.json');

const commands = [
    {
        name: 'remind',
        name_localizations: {
            'en-US': 'remind',
            'pl': 'przypomnij'
        },
        description: 'Set a reminder for yourself',
        description_localizations: {
            'en-US': 'Set a reminder for yourself',
            'pl': 'Ustaw przypomnienie dla siebie'
        },
        options: [
            {
                type: 3, // string
                name: 'message',
                name_localizations: {
                    'en-US': 'message',
                    'pl': 'wiadomość'
                },
                description: 'What to remind you of',
                description_localizations: {
                    'en-US': 'What to remind you of',
                    'pl': 'Co chcesz, żeby tobie przypomnieć'
                },
                required: true
            },
            {
                type: 3, // string
                name: 'when',
                name_localizations: {
                    'en-US': 'when',
                    'pl': 'kiedy'
                },
                description: 'When to remind you',
                description_localizations: {
                    'en-US': 'When to remind you',
                    'pl': 'Kiedy ci przypomnieć'
                },
                required: true
            }
        ]
    },
    {
        name: 'reminders',
        name_localizations: {
            'en-US': 'reminders',
            'pl': 'przypomnienia'
        },
        description: 'View your reminders',
        description_localizations: {
            'en-US': 'View your reminders',
            'pl': 'Zobacz swoje przypomnienia'
        }
    },
    {
        name: 'deleteReminder',
        name_localizations: {
            'en-US': 'deleteReminder',
            'pl': 'usunPrzypomnienie'
        },
        description: 'Delete a reminder',
        description_localizations: {
            'en-US': 'Delete a reminder',
            'pl': 'Usuń przypomnienie'
        },
        options: [
            {
                type: 3, // string
                name: 'name',
                name_localizations: {
                    'en-US': 'name',
                    'pl': 'nazwa'
                },
                description: 'Message of the reminder to delete',
                description_localizations: {
                    'en-US': 'Message of the reminder to delete',
                    'pl': 'Wiadomość przypomnienia do usunięcia'
                },
                required: true,
                autocomplete: true
            }
        ]
    }
]

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Registering app commands...');
        const data = await rest.options(Routes.applicationCommands(clientId), { body: commands });
        console.log(`Successfully registered ${data.length} application commands.`);
    } catch (e) {
        console.error('Error registering application commands:', e);
    }
})
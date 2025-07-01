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
            },
            {
                type: 3, // string
                name: 'dm',
                name_localizations: {
                    'en-US': 'dm',
                    'pl': 'dm'
                },
                description: 'Send the reminder in DMs',
                description_localizations: {
                    'en-US': 'Send the reminder in DMs',
                    'pl': 'Wyślij przypomnienie w wiadomości prywatnej'
                },
                required: false,
                choices: [
                    {
                        name: 'Yes',
                        name_localizations: {
                            'en-US': 'Yes',
                            'pl': 'Tak'
                        },
                        value: 'true'
                    },
                    {
                        name: 'No',
                        name_localizations: {
                            'en-US': 'No',
                            'pl': 'Nie'
                        },
                        value: 'false'
                    }
                ]
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
        name: 'deletereminder',
        name_localizations: {
            'en-US': 'deletereminder',
            'pl': 'usunprzypomnienie'
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
    },
    {
        name: 'settimezone',
        name_localizations: {
            'en-US': 'settimezone',
            'pl': 'strefaczasowa'
        },
        description: 'Set your timezone for reminders',
        description_localizations: {
            'en-US': 'Set your timezone for reminders',
            'pl': 'Ustaw swoją strefę czasową dla przypomnień'
        },
        options: [
            {
                type: 3, // string
                name: 'timezone',
                name_localizations: {
                    'en-US': 'timezone',
                    'pl': 'strefa'
                },
                description: 'Your timezone (e.g., America/New_York)',
                description_localizations: {
                    'en-US': 'Your timezone (e.g., America/New_York)',
                    'pl': 'Twoja strefa czasowa (np. Europa/Warszawa)'
                },
                required: true,
                autocomplete: true
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Registering app commands...');
        const data = await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log(`Successfully registered ${data.length} application commands.`);
    } catch (e) {
        console.error('Error registering application commands:', e);
    }
})();
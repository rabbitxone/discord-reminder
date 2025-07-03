# Discord reminder bot
This is a simple Discord bot that implements a reminder system similar to the one in Slack. It allows users to set reminders for themselves and have them sent to a specific channel or as a direct message.
Currently it supports Polish and English.

All the data is stored locally, in a SQLite database.

## Commands
- /remind <message> <time> [dm] - Set a reminder with the specified message and time (which can be in the natural language form, e.g. "in 5 minutes" or "tomorrow at 3pm"). If "dm" is specified, the reminder will be sent as a direct message to the user, otherwise it will be sent to the channel where the command was executed
- /reminders - List all reminders set by the user
- /deletereminder <message> - Delete a reminder with the specified message. The message is autocompleted so it's easier to search
- /settimezone <timezone> - In order for the bot to correctly calculate the time of the reminder, you need to set your timezone (if you don't, it will fall back to UTC). The timezone should be in the format "Europe/Warsaw" or "America/New_York". You can find a list of timezones [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
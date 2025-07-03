# Discord reminder bot
This is a simple Discord bot that implements a reminder system similar to the one in Slack. It allows users to set reminders for themselves and have them sent to a specific channel or as a direct message.
Currently it supports Polish and English.

All the data is stored locally, in a SQLite database.

## Commands
- /remind <message> <time> [dm] - Set a reminder with the specified message and time (which can be in the natural language form, e.g. "in 5 minutes" or "tomorrow at 3pm"). If "dm" is specified, the reminder will be sent as a direct message to the user, otherwise it will be sent to the channel where the command was executed
- /reminders - List all reminders set by the user
- /deletereminder <message> - Delete a reminder with the specified message. The message is autocompleted so it's easier to search
- /settimezone <timezone> - In order for the bot to correctly calculate the time of the reminder, you need to set your timezone (if you don't, it will fall back to UTC). The timezone should be in the format "Europe/Warsaw" or "America/New_York". You can find a list of timezones [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

## Screenshots
![Zrzut ekranu 2025-07-03 162054](https://github.com/user-attachments/assets/965e0434-aa76-43db-b826-f155c6caa3db)
![Zrzut ekranu 2025-07-03 162158](https://github.com/user-attachments/assets/cca9d586-e253-412d-b958-074f4b4238fa)
![Zrzut ekranu 2025-07-03 162231](https://github.com/user-attachments/assets/814a32dd-d798-4db9-93ad-28e805bc866c)
![Zrzut ekranu 2025-07-03 162716](https://github.com/user-attachments/assets/229e88d3-5911-4cda-8188-f88e2b452852)
![Zrzut ekranu 2025-07-03 162616](https://github.com/user-attachments/assets/f46572c7-b669-4d78-a9fd-6917ddbccf15)

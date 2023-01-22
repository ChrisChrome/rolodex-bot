const Discord = require('discord.js');
const {
	REST,
	Routes
} = require('discord.js');
// Needs intents: members, guilds
const client = new Discord.Client({
	intents: ['GuildMembers', 'Guilds']
});
const config = require('./config.json');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

db.on('open', () => {
	const schema = require('./schema.json');
	// Create tables if they don't exist
	for (const table in schema) {
		db.run(`CREATE TABLE IF NOT EXISTS ${table} (${schema[table].join(', ')})`);
	}
});

const commands = require('./commands.json');

const rest = new REST({
	version: '10'
}).setToken(config.discord.token);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	// Set up application commands
	const commands = require('./commands.json');

	(async () => {
		try {
			console.log('Started refreshing application (/) commands.');
			await rest.put(
				Routes.applicationGuildCommands(client.user.id, config.discord.guildId), {
					body: commands
				}
			);
			console.log('Successfully reloaded application (/) commands.');
		} catch (error) {
			console.error(error);
		}
	})();

});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
	console.log(`Received command ${interaction.commandName} from ${interaction.user.tag} (${interaction.user.id})`);
	console.log(interaction.options)
	// Command Schema is in commands.json
	switch (interaction.commandName) {
		case 'how':
			let embed = require("./embeds/how.json");
			interaction.reply({
				embeds: [embed],
				ephemeral: true
			});
			break;
		case 'lookup': //Description: Look up a user in the rolodex
			// Get the user's ID
			const user = interaction.options.get('user').user;
			// Get the user's information from the database
			db.get(`SELECT * FROM rolodex WHERE id = '${user.id}'`, (err, row) => {
				if (err) {
					console.error(err.message);
					interaction.reply({
						content: 'An error occurred while looking up the user.',
						ephemeral: true
					});
				}
				// If the user exists, send their information
				if (row) {
					// Reply with an embed, if an entry is null, don't include it
					let embed = new Discord.EmbedBuilder()
					embed.setTitle(`Rolodex Entry for ${user.username}`)
					embed.setColor('#0099ff')
					// Get avatar URL from Discord API based on the user's ID
					if (row.name) {
						embed.setTitle(`Rolodex Entry for ${row.name}`)
						embed.addFields([{
							name: "Name",
							value: row.name,
							inline: true
						}])
					}
					// Company
					if (row.company) embed.addFields([{
						name: 'Company',
						value: row.company,
						inline: true
					}]);
					// Phone number(s), three rows, phone1, phone2, phone3
					if (row.phone1 || row.phone2 || row.phone3) {
						let phones = '';
						if (row.phone1) phones += row.phone1 + '\n';
						if (row.phone2) phones += row.phone2 + '\n';
						if (row.phone3) phones += row.phone3 + '\n';

						embed.addFields([{
							name: 'Phone Number(s)',
							value: phones,
							inline: true
						}]);
					}
					// Fax number(s), three rows, fax1, fax2, fax3
					if (row.fax1 || row.fax2 || row.fax3) {
						let faxes = '';
						if (row.fax1) faxes += row.fax1 + '\n';
						if (row.fax2) faxes += row.fax2 + '\n';
						if (row.fax3) faxes += row.fax3 + '\n';
						embed.addFields([{
							name: 'Fax Number(s)',
							value: faxes,
							inline: true
						}]);
					}
					// Email Address
					if (row.email) embed.addFields([{
						name: 'Email Address',
						value: `[${row.email}](mailto:${row.email})`,
						inline: true
					}]);
					// Website
					if (row.website) embed.addFields([{
						name: 'Website',
						value: `[${row.website}](${row.website})`,
						inline: true
					}]);
					// Address
					if (row.address || row.city || row.state || row.zip || row.country) embed.addFields([{
						name: 'Address',
						value: `${row.address ? row.address + '\n' : ''}${row.city ? row.city + ', ' : ''}${row.state ? row.state + ' ' : ''}${row.zip ? row.zip : ''}${row.country ? '\n' + row.country : ''}`,
						inline: true
					}]);
					// Notes, Entirely based on user input
					if (row.notes) embed.addFields([{
						name: 'Notes',
						value: row.notes,
						inline: true
					}]);

					interaction.reply({
						embeds: [embed]
					});
				} else {
					// If the user doesn't have an entry, tell them
					interaction.reply({
						content: 'That user does not have a rolodex entry.',
						ephemeral: true
					});
				}
			});
			break;
		case 'rolodex': // Description: Manage your rolodex entry
			// Get the user's ID
			const userId = interaction.user.id;
			// Switch on the subcommand
			switch (interaction.options.getSubcommand()) {
				case 'generate': // Description: Generate a rolodex entry for yourself
					// Check if the user already has a rolodex entry
					db.get(`SELECT * FROM rolodex WHERE id = ${userId}`, (err, row) => {
						if (err) {
							console.error(err);
						}
						// If the user doesn't have an entry, create one
						if (!row) {
							db.run(`INSERT INTO rolodex (id) VALUES (${userId})`);
							interaction.reply({
								ephemeral: true,
								content: `Rolodex entry generated`
							});
						}
						// If the user already has an entry, tell them
						else {
							interaction.reply({
								ephemeral: true,
								content: `You already have a rolodex entry`
							});
						}
					});
					break;
				case 'set': // Description: Set a field in your rolodex entry
					// Get the key and value
					let key = interaction.options.get('key').value;
					let value = interaction.options.get('value').value;
					// Check if the user has an entry
					db.get(`SELECT * FROM rolodex WHERE id = ${userId}`, (err, row) => {
						if (err) {
							console.error(err);
						}
						// If the user doesn't have an entry, tell them
						if (!row) {
							interaction.reply({
								ephemeral: true,
								content: `You don't have a rolodex entry!`
							});
						}
						// If the user does have an entry, set the key to the value
						else {
							db.prepare(`UPDATE rolodex SET ${key} = ? WHERE id = ${userId}`).run(value);
							interaction.reply({
								ephemeral: true,
								content: `Rolodex entry updated!`
							});
						}
					});
					break;
				case 'remove': // Description: Delete a field in your rolodex entry
					// Get the key
					let key1 = interaction.options.get('key').value;
					// Check if the user has an entry
					db.get(`SELECT * FROM rolodex WHERE id = ${userId}`, (err, row) => {
						if (err) {
							console.error(err);
						}
						// If the user doesn't have an entry, tell them
						if (!row) {
							interaction.reply({
								ephemeral: true,
								content: `You don't have a rolodex entry!`
							});
						}
						// If the user does have an entry, delete the key
						else {
							db.run(`UPDATE rolodex SET ${key1} = NULL WHERE id = ${userId}`);
							interaction.reply({
								ephemeral: true,
								content: `Rolodex entry updated!`
							});
						}
					});
					break;
				case 'delete':
					// Check if the user has an entry
					db.get(`SELECT * FROM rolodex WHERE id = ${userId}`, (err, row) => {
						if (err) {
							console.error(err);
						}
						// If the user doesn't have an entry, tell them
						if (!row) {
							interaction.reply({
								ephemeral: true,
								content: `You don't have a rolodex entry!`
							});
						}
						// If the user does have an entry, delete it
						db.run(`DELETE FROM rolodex WHERE id = ${userId}`);
						interaction.reply({
							ephemeral: true,
							content: `Rolodex entry deleted!`
						});
					});
					break;

				case 'debug':
					// Check if the user running the command is the dev?
					if (!interaction.user.id === config.discord.devId) return interaction.reply({
						ephemeral: true,
						content: `You don't have permission to run this command!`
					});
					// Switch subcommands
					switch (interaction.options.getSubcommand()) {
						case 'sql':
							// Get the SQL query
							let sql = interaction.options.get('query').value;
							let print = interaction.options.get('print').value;
							// Run the query
							db.prepare(sql, (err, res) => {
								if (err) {
									interaction.reply({
										ephemeral: !print || true,
										content: `Error: ${err}`
									});
								} else {
									interaction.reply({
										ephemeral: !print || true,
										content: `Response: ${res}`
									});
								}
							}).run();
							break;
						case 'stats':
							console.log("Debug Stats")
							// Get how many rows are in the database
							db.get(`SELECT COUNT(*) FROM rolodex`, (err, row) => {
								if (err) {
									console.error(err);
								}
								// Tell the user the amount of entries
								interaction.reply({
									content: `There are ${row['COUNT(*)']} entries in the database`
								});
							});
							break;
					}
					break;
				default: // Description: If the subcommand doesn't exist, tell the user
					interaction.reply({
						ephemeral: true,
						content: `That subcommand doesn't exist!`
					});
					break;
			}
	}

});

client.login(config.discord.token);
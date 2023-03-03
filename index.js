const Discord = require('discord.js');
const fs = require("fs");
const {
	REST,
	Routes
} = require('discord.js');
// Needs intents: members, guilds
const client = new Discord.Client({
	intents: ['GuildMembers', 'Guilds']
});
const config = require('./config.json');
const lang = require('./lang.json');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');



db.on('open', () => {
	const schema = require('./schema.json');
	// Create tables if they don't exist
	for (const table in schema) {
		db.run(`CREATE TABLE IF NOT EXISTS ${table} (${schema[table].join(', ')})`);
	}
});
let vCardsJS = require('vcards-js');
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
	//console.log(interaction.options)
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
					let vCard = vCardsJS();
					// Reply with an embed, if an entry is null, don't include it
					let embed = new Discord.EmbedBuilder()
					// Use lang file
					embed.setTitle(lang.responses.rolodex.entry_for.replace('%s', user.username))
					embed.setColor('#0099ff')
					// Get avatar URL from Discord API based on the user's ID
					if (row.name) {
						vCard.firstName = row.name.split(' ')[0];
						vCard.lastName = row.name.split(' ')[1] || '';
						embed.setTitle(lang.responses.rolodex.entry_for.replace('%s', row.name))
						embed.addFields([{
							name: lang.responses.rolodex.fields.name,
							value: row.name,
							inline: true
						}])
					}
					// Company
					if (row.company) {
						vCard.organization = row.company;
						embed.addFields([{
							name: lang.responses.rolodex.fields.company,
							value: row.company,
							inline: true
						}]);
					}
					// Phone number(s), three rows, phone1, phone2, phone3
					if (row.phone1 || row.phone2 || row.phone3) {
						let phones = '';
						// remove spaces, dashes, parentheses, and all other special characters except for plus sign, then add them to an array, then get rid of any characters past the 12th character

						let phoneArray = [];
						if (row.phone1) phoneArray.push(row.phone1.replace(/[^0-9+]/g, '').substring(0, 12));
						if (row.phone2) phoneArray.push(row.phone2.replace(/[^0-9+]/g, '').substring(0, 12));
						if (row.phone3) phoneArray.push(row.phone3.replace(/[^0-9+]/g, '').substring(0, 12));
						if (row.phone1) phones += row.phone1 + '\n';
						if (row.phone2) phones += row.phone2 + '\n';
						if (row.phone3) phones += row.phone3 + '\n';

						vCard.otherPhone = phoneArray;

						embed.addFields([{
							name: lang.responses.rolodex.fields.phone,
							value: phones,
							inline: true
						}]);
					}
					// Fax number(s), three rows, fax1, fax2, fax3
					if (row.fax1 || row.fax2 || row.fax3) {
						let faxes = '';

						let faxArray = [];
						if (row.fax1) faxArray.push(row.fax1.replace(/[^0-9+]/g, '').substring(0, 12));
						if (row.fax2) faxArray.push(row.fax2.replace(/[^0-9+]/g, '').substring(0, 12));
						if (row.fax3) faxArray.push(row.fax3.replace(/[^0-9+]/g, '').substring(0, 12));
						if (row.fax1) faxes += row.fax1 + '\n';
						if (row.fax2) faxes += row.fax2 + '\n';
						if (row.fax3) faxes += row.fax3 + '\n';

						vCard.homeFax = faxArray;
						embed.addFields([{
							name: lang.responses.rolodex.fields.fax,
							value: faxes,
							inline: true
						}]);
					}
					// Email Address
					if (row.email) {
						vCard.workEmail = row.email;
						embed.addFields([{
							name: lang.responses.rolodex.fields.email,
							value: `[${row.email}](mailto:${row.email})`,
							inline: true
						}]);
					}
					// Website
					if (row.website) {
						sites = row.website.split(' | ');
						vCard.url = row.website[0];
						allSites = '';
						sites.forEach(site => {
							allSites += `[${site}](${site})\n`;
						})
						embed.addFields([{
							name: lang.responses.rolodex.fields.website,
							value: allSites,
							inline: true
						}]);
					}
					// Address
					if (row.address || row.city || row.state || row.zip || row.country) {
						embed.addFields([{
							name: lang.responses.rolodex.fields.address,
							value: `${row.address ? row.address + '\n' : ''}${row.city ? row.city + ', ' : ''}${row.state ? row.state + ' ' : ''}${row.zip ? row.zip : ''}${row.country ? '\n' + row.country : ''}`,
							inline: true
						}]);
					}
					// Notes, Entirely based on user input
					if (row.notes) {
						vCard.note = row.notes;
						embed.addFields([{
							name: lang.responses.rolodex.fields.notes,
							value: row.notes,
							inline: true
						}]);
					}
					vCard.saveToFile(`./tmp/vcard.vcf`);
					setTimeout(() => {
						interaction.reply({
							embeds: [embed],
							files: [{
								attachment: `./tmp/vcard.vcf`
							}]
						}).then(() => {
							fs.unlinkSync(`./tmp/vcard.vcf`);
						});
					}, 200);
				} else {
					// If the user doesn't have an entry, tell them
					interaction.reply({
						content: lang.responses.rolodex.no_entry,
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
				case 'export': // Description: Export the entire rolodex
					// Check if user has administrator permission or is dev
					// If the user both doesn't have admin and isn't in the discord.devIds array, tell them they don't have permission	
					if (!interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator) && !config.discord.devIds.includes(interaction.user.id)) {
						console.log(`!!!!!!!ITS EXPORT!!!!!!!`)
						interaction.reply({
							content: lang.responses.no_perm,
							ephemeral: true
						});
						return;
					}
					// Get all the entries
					db.all(`SELECT * FROM rolodex`, (err, rows) => {
						if (err) {
							console.error(err);
						}
						// If there are no entries, tell the user
						if (!rows.length) {
							interaction.reply({
								content: lang.responses.rolodex.no_entries,
								ephemeral: true
							});
						} else {
							// Create either a json object or CSV based on the user's preference, default to CSV
							let exportData = '';
							switch (interaction.options.getString('format')) {
								case 'json':
									exportData = JSON.stringify(rows, null, 2);
									interaction.reply({
										files: [{
											attachment: Buffer.from(exportData),
											name: `rolodex.json`
										}],
										ephemeral: true
									});
									break;
								case 'csv':
									exportData = 'id,name,company,phone1,phone2,phone3,fax1,fax2,fax3,email,address,city,state,zip,country,notes,website\r\n';
									rows.forEach(row => {
										exportData += `${csvFormat(row.id)},${csvFormat(row.name)},${csvFormat(row.company)},${csvFormat(row.phone1)},${csvFormat(row.phone2)},${csvFormat(row.phone3)},${csvFormat(row.fax1)},${csvFormat(row.fax2)},${csvFormat(row.fax3)},${csvFormat(row.email)},${csvFormat(row.address)},${csvFormat(row.city)},${csvFormat(row.state)},${csvFormat(row.zip)},${csvFormat(row.country)},${csvFormat(row.notes)},${csvFormat(row.website)}\r\n`;
									});
									interaction.reply({
										files: [{
											attachment: Buffer.from(exportData),
											name: `rolodex.csv`
										}],
										ephemeral: true
									});
									break;
								case 'db': // Description: Export the database file
									// Get the database file
									const dbFile = fs.readFileSync('./database.db');
									// Send the file
									interaction.reply({
										files: [{
											attachment: dbFile,
											name: 'rolodex.db'
										}],
										ephemeral: true
									});
									break;
							}
						}
					});
					break;

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
								content: lang.responses.rolodex.generation.success
							});
						}
						// If the user already has an entry, tell them
						else {
							interaction.reply({
								ephemeral: true,
								content: lang.responses.rolodex.generation.failure
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
								content: lang.responses.rolodex.edit.no_entry
							});
						}
						// If the user does have an entry, set the key to the value
						else {
							db.prepare(`UPDATE rolodex SET ${key} = ? WHERE id = ${userId}`).run(value);
							interaction.reply({
								ephemeral: true,
								content: lang.responses.rolodex.edit.success
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
								content: lang.responses.rolodex.edit.no_entry
							});
						}
						// If the user does have an entry, delete the key
						else {
							db.run(`UPDATE rolodex SET ${key1} = NULL WHERE id = ${userId}`);
							interaction.reply({
								ephemeral: true,
								content: lang.responses.rolodex.edit.success
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
							return interaction.reply({
								ephemeral: true,
								content: lang.responses.rolodex.edit.no_entry
							});
						}
						// If the user does have an entry, delete it
						db.run(`DELETE FROM rolodex WHERE id = ${userId}`);
						interaction.reply({
							ephemeral: true,
							content: lang.responses.rolodex.edit.deleted
						});
					});
					break;
				default: // Description: If the subcommand doesn't exist, tell the user
					interaction.reply({
						ephemeral: true,
						content: lang.responses.sub_not_found
					});
					break;
			}

			case 'dev':
				// Check if the user running the command is the dev?
				if (!config.discord.devIds.includes(interaction.user.id)) {
					console.log("!!!!!!!ITS DEV!!!!!!!!");
					return interaction.reply({
						ephemeral: true,
						content: lang.responses.no_perm
					});
				}
				// Switch subcommands
				switch (interaction.options.getSubcommand()) {
					case 'stats':
						console.log("Debug Stats")
						// Get how many rows are in the database
						db.get(`SELECT COUNT(*) FROM rolodex`, (err, row) => {
							if (err) {
								console.error(err);
							}
							// Tell the user the amount of entries
							interaction.reply({
								content: lang.responses.dev.stats.replace('%s', row['COUNT(*)'])
							});
						});
						break;
					case 'eval': // Evaluate a JS expression then return the result
						// Get the expression
						let expression = interaction.options.get('code').value;
						// Evaluate the expression, get the output, and send it

						try {
							interaction.reply({
								ephemeral: true,
								content: String(eval(expression))
							});
						} catch (err) {
							interaction.reply({
								ephemeral: true,
								content: `Error: ${err}`
							});
						}


						break;
				}
				break;

			case 'role':
				// Check if the user running the command is the dev?
				if (!config.discord.devIds.includes(interaction.user.id)) {
					console.log("!!!!!!!ITS ROLE!!!!!!!!");
					return interaction.reply({
						ephemeral: true,
						content: lang.responses.no_perm
					});
				}
				// Switch subcommands
				switch (interaction.options.getSubcommand()) {
					case 'add':
						// Get the role ID
						let roleIdA = interaction.options.get('role').value;
						let userIdA = interaction.options.get('user').value;
						// Try to add the role to the user
						try {
							interaction.guild.members.cache.get(userIdA).roles.add(roleIdA);
							interaction.reply({
								ephemeral: true,
								content: `Role added!`
							});
						}
						// If the role can't be added, tell the user
						catch (err) {
							interaction.reply({
								ephemeral: true,
								content: `I couldn't add that role!`
							});
						}
						break;
					case 'remove':
						// Get the role ID
						let roleId = interaction.options.get('role').value;
						let userId = interaction.options.get('user').value;
						// Try to remove the role from the user
						try {
							interaction.guild.members.cache.get(userId).roles.remove(roleId);
							interaction.reply({
								ephemeral: true,
								content: `Role removed!`
							});
						}
						// If the role can't be removed, tell the user
						catch (err) {
							interaction.reply({
								ephemeral: true,
								content: `I couldn't remove that role!`
							});
						}
						break;
				}
				break;

	}

});

// Random Shit

const csvFormat = (str) => {
	if (str === null) return '""';
	return `"${String(str).replace(/"/g, '“')}"`;
}

client.login(config.discord.token);
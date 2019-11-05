/* Konfiguráció */
var config = require('./config.json');

const Discord = require('discord.js');
const client = new Discord.Client();
var https = require('https');
var fs = require('fs');
var mysql = require('mysql');

let pool = mysql.createPool(config.mysql);

client.login(config.token);

client.on('ready', () => {
    console.log('Sikeres betöltés!');     
    nameChange();
});

process.on('SIGINT', function() {
    console.log("Lecsatlakozás...");
        client.destroy()
        process.exit();
});

/*---------------------------------------------------------------------*/
                            // FUNCTIONS //

function sleep (milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function isset(foo) {
    if (typeof foo != 'undefined') {
        return true;
    } else {
        return false;
    }
}

function pickRandom(array){
    var rand = array[Math.floor(Math.random() * array.length)];
    return rand;
}

function mentionUser (user) {
    return "<@"+user.id+">"
}

async function nameChange () {
    client.user.setActivity("davidjaksa.com", {type: "WATCHING"})
}

async function delayDelete (message, time) {
    if (isset(time)) {
        await sleep(time);
    } else {
        await sleep(5000);
    }
    message.delete();
}

/*---------------------------------------------------------------------*/

function isJsonString(str321) {
    try {
        JSON.parse(str321);
    } catch (e) {
        return false;
    }
    return true;
}

function getUserCredentials(user, callback) {

    pool.getConnection(function(err, connection) {
        connection.query("SELECT * FROM users WHERE dcid = ?", [user.id], function (err, result, fields) {
            if (err) throw err;
            callback(result);
        });
    });
}

function loginUser(message, args) {

    getUserCredentials(message.author, function (result) {
        if (JSON.stringify(result) != "[]") {
            message.channel.send('Már be vagy jelentkezve! Kijelentkezéshez használd a `:logout` parancsot!');
            return;
        } else {

            if (args.length != 3) { message.channel.send('Hibásan megadott paraméterek!\n`:login <felhasznalonev> <jelszo> <intezmenyid>`'); return; }

            var URL = args[2] + ".e-kreta.hu";
            var PATH = "/idp/api/v1/Token";

            var postData = "institute_code=" + args[2] + "&userName="+args[0]+"&password="+args[1]+"&grant_type=password&client_id=919e0c1c-76a2-4646-a2fb-7085bbbf3c56";

            var options = {
                host: URL,
                port: 443,
                path: PATH,
                method: 'POST',
                ecdhCurve: 'auto', 
                headers: {
                    'Content-Length': postData.length,
                    'Content-type': 'application/x-www-form-urlencoded; charset=utf-8',
                }
            };

            var req = https.request(options, function(res) {
                res.setEncoding('utf8');

                if (res.statusCode != 200) {                    
                    message.channel.send('Hiba történt a bejelentkezés során!');
                    return;
                }

                message.channel.send('Sikeres bejelentkezés! :white_check_mark: \n:warning: Biztonsági okok miatt arra kérünk, hogy **töröld ki** a bejelentkezési adataidat tartalmazó üzeneted. :warning: ');

                res.on('data', function(body) {


                });

                var str234='';
                res.on('data',function(chunk){
                    str234+=chunk;
                });


                res.on('end',function(){
                    var bodyJson = JSON.parse(str234);

                    var refresh_token = bodyJson["refresh_token"].toString().replace('\\', '\\\\');
                    var access_token = bodyJson["access_token"].toString().replace('\\', '\\\\');


                    pool.getConnection(function(err, connection) {
                        connection.query("INSERT INTO users(dcid, institute_code, refresh_token, access_token, expires_in) VALUES("+message.author.id+", '"+args[2]+"', '"+refresh_token+"', '"+access_token+"', "+bodyJson["expires_in"]+" )");
                    });

                });
            });

            req.on('error', function(e) {
                console.log('problem with request: ' + e.message);
            });

            // write some data to the request body
            req.write(postData);
            req.end();
        }
    });
}

function refreshToken(message, callback) {
    getUserCredentials(message.author, function (result) {
        if (JSON.stringify(result) == "[]") {
            return;
        } else {
            var settings = result[0];
            var URL = settings["institute_code"] + ".e-kreta.hu";
            var PATH = "/idp/api/v1/Token";

            var postData = "institute_code=" + settings["institute_code"] + "&refresh_token=" + settings["refresh_token"] + "&grant_type=refresh_token&client_id=919e0c1c-76a2-4646-a2fb-7085bbbf3c56";

            var options = {
                host: URL,
                port: 443,
                path: PATH,
                method: 'POST',
                ecdhCurve: 'auto',
                headers: {
                    'Content-Length': postData.length,
                    'Content-type': 'application/x-www-form-urlencoded; charset=utf-8',
                }
            };

            var req = https.request(options, function(res) {
                res.setEncoding('utf8');

                if (res.statusCode != 200) {
                    message.channel.send('Hiba történt az hozzáférési token lekérésekor!');
                    return;
                }

                var refreshstr='';

                res.on('data',function(chunk){
                    refreshstr+=chunk;
                });


                res.on('end',function(){
                    var bodyJson = JSON.parse(refreshstr);

                    pool.getConnection(function(err, connection) {
                        connection.query("UPDATE users SET access_token = '"+ bodyJson["access_token"] +"', refresh_token = '"+bodyJson["refresh_token"]+"' WHERE dcid = "+message.author.id);
                    });
                    callback(bodyJson['access_token']); 
                });
            });

            req.on('error', function(e) {
            console.log('problem with request: ' + e.message);
            });

            // write some data to the request body
            req.write(postData);
            req.end();
        }
    });
}

function logout(message, args) {

    getUserCredentials(message.author, function (result) {
        if (JSON.stringify(result) == "[]") {
            message.channel.send('Nem vagy bejelentkezve! Bejelentkezéshez használd a `:login` parancsot!');
            return;
        } else {
            pool.getConnection(function(err, connection) {
                connection.query("DELETE FROM users WHERE dcid = ?", [message.author.id]);
                message.channel.send('Sikeres kijelentkezés!');
            });
        }
    });
}

function sendJegyek(message, args, bodyJSON){

    result = bodyJSON.Evaluations.reduce(function (r, a) {
        r[a.Subject] = r[a.Subject] || [];
        r[a.Subject].push(a);
        return r;
    }, Object.create(null));
    
    const jegyekEmbed = new Discord.RichEmbed()
        .setColor('#1979e0')
        .setTitle('Az idei jegyeid')
        .setAuthor(bodyJSON.Name, message.author.avatarURL, '');
        
        Object.keys(result).forEach(function (key) {
            var str1 = "";
            result[key].forEach(jegy => {
                if (jegy.Theme != "") {
                    str1 = str1 + jegy.Value + " | " + jegy.Theme  + " | " + jegy.CreatingTime.substr(0, 10) + "\n";
                } else {
                    str1 = str1 + jegy.Value + " | " + jegy.CreatingTime.substr(0, 10) + "\n";
                }
            });
            jegyekEmbed.addField(key, str1)  
        })
        jegyekEmbed.setFooter('E-Kretén', 'https://scontent-lhr3-1.cdninstagram.com/vp/ee90939bc4e85c9a2581b0ca2d3dc567/5E4AABB5/t51.2885-19/s150x150/61320441_442386149878298_396437971185696768_n.jpg?_nc_ht=scontent-lhr3-1.cdninstagram.com');

    message.channel.send(jegyekEmbed);
}

function sendAtlag(message, args, bodyJSON){
    const atlagEmbed = new Discord.RichEmbed()
        .setColor('#1979e0')
        .setAuthor(bodyJSON.Name + " - Átlagok", message.author.avatarURL, '');

        Object.values(bodyJSON.SubjectAverages).forEach(tantargy => {
            str2 = "Átlag: " + tantargy.Value;
            atlagEmbed.addField(tantargy.Subject, str2);
        });

        atlagEmbed.setFooter('E-Kretén', 'https://scontent-lhr3-1.cdninstagram.com/vp/ee90939bc4e85c9a2581b0ca2d3dc567/5E4AABB5/t51.2885-19/s150x150/61320441_442386149878298_396437971185696768_n.jpg?_nc_ht=scontent-lhr3-1.cdninstagram.com');

    message.channel.send(atlagEmbed);
}

function doCommand(message, args, commandToDo) {
    message.delete();
    getUserCredentials(message.author, function (result) {
        refreshToken(message, function (access_token) {
            if (JSON.stringify(result) == "[]") {
                message.channel.send('Még nem vagy bejelentkezve!\nBejelentkezéshez használd a `:login` parancsot!');
                return;
            } else {
                var tokenfile = result[0];    
    
                if (args.length != 0) { message.channel.send('Hibásan megadott paraméterek!\n`:jegyek`'); return; }
    
                var URL = tokenfile["institute_code"]+".e-kreta.hu";
                var PATH = "/mapi/api/v1/Student";
    
                var options = {
                    host: URL,
                    port: 443,
                    path: PATH,
                    method: 'GET',
                    ecdhCurve: 'auto', //secp384r1
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    }
                };
    
                var req = https.request(options, function(res) {
                    res.setEncoding('utf8');
    
                    // On data
                    var jegyekstr='';
                    res.on('data',function(chunk){
                        jegyekstr+=chunk;
                    });
    
    
                    res.on('end',function(){
                        if (isJsonString(jegyekstr)) {
                            obj=JSON.parse(jegyekstr);
    
                            eval(commandToDo + "(message, args, obj)");
                        } else {
                            message.channel.send(jegyekstr);
                            refreshToken(message, args, "doCommand(message, args, "+commandToDo+")");
                        }
                    });
    
                });
    
    
                req.on('error', function(e) {
                    console.log('problem with request: ' + e.message);
                });
    
                // write some data to the request body
                req.write('\n');
                req.end();
            }
        });
    });
}

/*---------------------------------------------------------------------*/

client.on('message', message => {
    if (!message.content.startsWith(config.prefix) || message.author.bot) return;
    //if (message.channel.type != "text") return;
    
	const args = message.content.slice(config.prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'login') {
        if (message.channel.type != "dm") {
            message.reply('ezt a parancsot csak privátban használhatod! :no_entry:')
            .then(message => delayDelete(message));

            message.delete();
            return;
        }
        loginUser(message, args);
    }

    if (command === 'jegyek') {
        if (message.channel.type != "dm") {
            message.reply('ezt a parancsot csak privátban használhatod! :no_entry:')
            .then(errorMessage => {
                delayDelete(message);
                delayDelete(errorMessage);
            });
            return;
        }
        doCommand(message, args, "sendJegyek");
    }

    if (command === 'ertesites') {
        ertesites(message, args);
    }

    if (command === 'atlag') {
        doCommand(message, args, "sendAtlag");
    }

    if (command === 'logout') {
        logout(message, args);
    }

});

client.on("guildCreate", guild => {

    if (find_result = guild.channels.find("name","ekreten")) {
        pool.getConnection(function(err, connection) {
            connection.query("INSERT INTO channels(guildid, channelid) VALUES("+guild.id+", "+find_result.id+")");
        });

        guild.systemChannel.send("Köszi a meghívást! :smile:\nMegtaláltam az <#"+find_result.id+"> nevű csatornát, az értesítések ott fognak megjelenni! :white_check_mark:");

        return;
    }

    guild.createChannel("ekreten", "text").then(channel => {
        if (!channel) {
            message.channel.send('Hiba történt a `#ekreten` nevű csatorna létrehozása közben!');
            return;
        }

        pool.getConnection(function(err, connection) {
            connection.query("INSERT INTO channels(guildid, channelid) VALUES("+guild.id+", "+channel.id+")");
        });
        guild.systemChannel.send("Köszi a meghívást! :smile:\nLétrehoztam az <#"+channel.id+"> nevű csatornát az értesítéseknek! :white_check_mark:");
    });
});

client.on("guildDelete", guild => {
    pool.getConnection(function(err, connection) {
        connection.query("DELETE FROM channels WHERE guildid = ?", [guild.id]);
    });
})
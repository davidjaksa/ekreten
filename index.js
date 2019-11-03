/* Konfiguráció */
const config = [];
config['token'] = 'NjM5MTYzMjA2MzIxMDQ1NTI0.XbnRVg.OeQ4wOMqJHHFhsUIXCcoUj8xy90'; // Bot token
config['prefix'] = ':'; // Parancs prefix

const Discord = require('discord.js');
const client = new Discord.Client();
var https = require('https');
var fs = require('fs');
var mysql = require('mysql');

let pool = mysql.createPool({
    host: 'davidjaksa.com',
    user: 'admin_dc_kreta',
    password: 'almaspite',
    database: 'admin_dc_kreta'
});

client.login(config['token']);

client.on('ready', () => {
    console.log('Sikeres betöltés!');     
    //nameChange();
});

process.on('SIGINT', function() {
    console.log("Lecsatlakozás...");
        client.destroy()
        process.exit();
});

/*---------------------------------------------------------------------*/
                            // FUNCTIONS //

function safeBackSlash (str123) {
    str123.replace('/', '//');
}

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
    while (1) {
        client.user.setActivity("CultureGeeks", {type: "WATCHING"})
        await sleep(5000);
        client.user.setActivity("with Gyula", {type: "PLAYING"})
        await sleep(5000);
    }
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
            //console.log(user.id);
            if (err) throw err;
            //console.log(result);
            callback(result);
        });
    });
}

function loginUser(message, args) {

    message.delete();

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
                //console.log(res.statusCode);

                if (res.statusCode != 200) {
                    //process.exit()
                    
                    message.channel.send('Hiba történt a bejelentkezés során!');
                    return;
                }

                message.channel.send('Sikeres bejelentkezés!');

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

                    //console.log("\n" + newJson + "\n");
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

function refreshToken(message, args) {
    getUserCredentials(message.author, function (result) {
        if (JSON.stringify(result) == "[]") {
            //message.channel.send('Még nem vagy bejelentkezve!\nBejelentkezéshez használd a `:login` parancsot!');
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
                ecdhCurve: 'auto', //secp384r1
                headers: {
                    'Content-Length': postData.length,
                    'Content-type': 'application/x-www-form-urlencoded; charset=utf-8',
                }
            };

            var req = https.request(options, function(res) {
                res.setEncoding('utf8');
                console.log(res.statusCode);

                if (res.statusCode != 200) {
                    
                }

                var str345='';
                res.on('data',function(chunk){
                    str345+=chunk;
                });


                res.on('end',function(){
                    var bodyJson = JSON.parse(str345);

                    pool.getConnection(function(err, connection) {
                        connection.query("UPDATE users SET access_token = '"+ bodyJson["access_token"] +"' WHERE dcid = "+message.author.id);
                    });
                });

                jegyek(message, args);
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

function sendJegyek(message, bodyJSON){

    result = bodyJSON.Evaluations.reduce(function (r, a) {
        r[a.Subject] = r[a.Subject] || [];
        r[a.Subject].push(a);
        return r;
    }, Object.create(null));
    //console.log(result);
    
    const jegyekEmbed = new Discord.RichEmbed()
        .setColor('#1979e0')
        .setTitle('Az idei jegyeid')
        .setAuthor(message.author.username, message.author.avatarURL, '')
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

function jegyek(message, args) {
    getUserCredentials(message.author, function (result) {
        if (JSON.stringify(result) == "[]") {
            message.channel.send('Még nem vagy bejelentkezve!\nBejelentkezéshez használd a `:login` parancsot!');
            return;
        } else {
            //console.log(result[0]);
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
                    //'Content-type': 'application/x-www-form-urlencoded; charset=utf-8',
                    'Authorization': 'Bearer ' + tokenfile["access_token"]
                }
            };

            var req = https.request(options, function(res) {
                res.setEncoding('utf8');

/*                 if (res.statusCode == 401) {
                    refreshToken();
                } */

                // On data
                var jegyekstr='';
                res.on('data',function(chunk){
                    jegyekstr+=chunk;
                });


                res.on('end',function(){
                    if (isJsonString(jegyekstr)) {
                        obj=JSON.parse(jegyekstr);
                        sendJegyek(message, obj);
                } else {
                        //console.log(jegyekstr);
                        refreshToken(message, args);
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
}

/*---------------------------------------------------------------------*/

client.on('message', message => {
    if (!message.content.startsWith(config['prefix']) || message.author.bot) return;
    //if (message.channel.type != "text") return;
    
	const args = message.content.slice(config['prefix'].length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'login') {
        loginUser(message, args);
    }

    if (command === 'jegyek') {
        jegyek(message, args);
    }

/*     if (command === 'refresh') {
        refreshToken(message, args);
    } */

    if (command === 'logout') {
        logout(message, args);
    }
    
/*     if (command === 'getcredentials') {
        getUserCredentials(message.author);
    } */

    // Több command...
});
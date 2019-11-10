/* Konfiguráció */
var config = require('./config.json');

const Discord = require('discord.js');
const client = new Discord.Client();
var https = require('https');
var mysql = require('mysql');
var moment = require('moment');
moment().localeData("hu");
moment().format('LL');

let pool = mysql.createPool(config.mysql);

client.login(config.token);

client.on('ready', () => {
    console.log('Sikeres betöltés!');     
    nameChange();
    check();
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
    client.user.setActivity("ekreten.davidjaksa.com", {type: "WATCHING"})
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

function getUserCredentials(dcid, callback) {
    pool.getConnection(function(err, connection) {
        connection.query("SELECT * FROM users WHERE dcid = ?", [dcid], function (err, result, fields) {
            if (err) throw err;
            callback(result);
        });
    });
}

function getGuildNotificationChannel(guild, callback) {
    pool.getConnection(function(err, connection) {
        connection.query("SELECT * FROM guilds WHERE guildid = ?", [guild.id], function (err, result, fields) {
            if (err) throw err;
            var ekreten_channel = client.channels.find("id", result[0].channelid.toString());

            callback(ekreten_channel);
        });
    });
}

function loginUser(message, args) {

    getUserCredentials(message.author.id, function (result) {
        if (JSON.stringify(result) != "[]") {
            message.channel.send('Már be vagy jelentkezve! Kijelentkezéshez használd a `:logout` parancsot!');
            return;
        } else {
            isAdatkezelesElfogadva(message.author.id, (isElfogadva) => {

                if (!isElfogadva) {
                    message.channel.send("Még nem fogadtad el az adatkezelési nyilatkozatot! :x:\n`:adatkezeles`");
                    return;
                }

                if (args.length != 3) { 
                    message.channel.send('Hibásan megadott paraméterek!\n`:login <felhasznalonev> <jelszo> <intezmenyid>`\nIntézményazonosító lista: https://ekreten.davidjaksa.com/intezmeny-lista/'); 
                    return; 
                }

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
    
                    var str234='';
                    res.on('data',function(chunk){
                        str234+=chunk;
                    });
    
    
                    res.on('end',function(){
                        if (!isJsonString(str234)) {
                            message.channel.send('Hiba történt a bejelentkezés közben, kérlek próbáld újra később! :warning:');
                            return;
                        }
                        var bodyJson = JSON.parse(str234);
    
                        var refresh_token = bodyJson["refresh_token"].toString().replace('\\', '\\\\');
                        var access_token = bodyJson["access_token"].toString().replace('\\', '\\\\');
    
    
                        pool.getConnection(function(err, connection) {
                            connection.query("INSERT INTO users(dcid, institute_code, refresh_token, access_token, expires_in) VALUES("+message.author.id+", '"+args[2]+"', '"+refresh_token+"', '"+access_token+"', "+bodyJson["expires_in"]+" )", function (error, results, fields) {
                                if (error) throw error;
    
                                insertJegyek(message.author.id, true);
                            });
                        });
    
                        message.channel.send('Sikeres bejelentkezés! :white_check_mark: \n:warning: Biztonsági okok miatt arra kérünk, hogy **töröld ki** a bejelentkezési adataidat tartalmazó üzeneted. :warning: ');
                    });
                });
    
                req.on('error', function(e) {
                    console.log('problem with request: ' + e.message);
                });
    
                // write some data to the request body
                req.write(postData);
                req.end();
            });
        }
    });
}

function refreshToken(dcid, callback) {
    getUserCredentials(dcid, function (result) {
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
                    return;
                }

                var refreshstr='';

                res.on('data',function(chunk){
                    refreshstr+=chunk;
                });


                res.on('end',function(){
                    if (!isJsonString(refreshstr)) {
                        console.log("Hiba történt (refreshToken)", refreshstr);
                        return;
                    }
                    var bodyJson = JSON.parse(refreshstr);

                    pool.getConnection(function(err, connection) {
                        connection.query("UPDATE users SET access_token = '"+ bodyJson["access_token"] +"', refresh_token = '"+bodyJson["refresh_token"]+"' WHERE dcid = "+dcid);
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

    getUserCredentials(message.author.id, function (result) {
        if (JSON.stringify(result) == "[]") {
            message.channel.send('Nem vagy bejelentkezve! Bejelentkezéshez használd a `:login` parancsot!');
            return;
        } else {
            pool.getConnection(function(err, connection) {
                connection.query("DELETE FROM users WHERE dcid = ?", [message.author.id]);

                connection.query("DELETE FROM notifications WHERE dcid = ?", [message.author.id]);
                connection.query("DELETE FROM evaluations WHERE dcid = ?", [message.author.id]);
                connection.query("DELETE FROM privacy_accepts WHERE dcid = ?", [message.author.id]);

                message.channel.send('Sikeres kijelentkezés!');
            });
        }
    });
}

function jegyek(message, args){
    getUserData (message, function (bodyJSON) {
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
    });
}

function atlag(message, args){
    getUserData (message, function (bodyJSON) {
        const atlagEmbed = new Discord.RichEmbed()
            .setColor('#1979e0')
            .setAuthor(bodyJSON.Name + " - Átlagok", message.author.avatarURL, '');

            Object.values(bodyJSON.SubjectAverages).forEach(tantargy => {
                str2 = "Átlag: " + tantargy.Value;
                atlagEmbed.addField(tantargy.Subject, str2);
            });

            atlagEmbed.setFooter('E-Kretén', 'https://scontent-lhr3-1.cdninstagram.com/vp/ee90939bc4e85c9a2581b0ca2d3dc567/5E4AABB5/t51.2885-19/s150x150/61320441_442386149878298_396437971185696768_n.jpg?_nc_ht=scontent-lhr3-1.cdninstagram.com');

        message.channel.send(atlagEmbed);
    });
}

function getUserData(message, callback) {
    console.log(0);
    getUserCredentials(message.author.id, function (result) {
        console.log(1);
        if (JSON.stringify(result) == "[]") {
            message.channel.send('Még nem vagy bejelentkezve!\nBejelentkezéshez használd a `:login` parancsot!');
            return;
        } else {
            refreshToken(message.author.id, function (access_token) {
                var settings = result[0];    
    
                //if (args.length != 0) { message.channel.send('Hibásan megadott paraméterek!\n`:jegyek`'); return; }
    
                var URL = settings["institute_code"]+".e-kreta.hu";
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
    
                            callback(obj);
                        } else {
                            message.reply('Hiba történt az adatok lekérdezése közben!');
                        }
                    });
    
                });
    
                req.on('error', function(e) {
                    console.log('problem with request: ' + e.message);
                });
    
                // write some data to the request body
                req.write('\n');
                req.end();
            });
        }
        
    });
}

function getUserEvaluations(dcid, callback) {
    console.log("Jegyek lekérve!");
    getUserCredentials(dcid, function (result) {
        refreshToken(dcid, function (access_token) {
            var settings = result[0];    

            var URL = settings["institute_code"]+".e-kreta.hu";
            var PATH = "/mapi/api/v1/Student";
/* 
            var URL = "dev.davidjaksa.com";
            var PATH = "/kreta/test.json"; */

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
                    if (!isJsonString(jegyekstr)) {
                        console.log("Hiba történt! (getUserEvaluations)", jegyekstr);
                        return;
                    }

                    obj=JSON.parse(jegyekstr);
                    callback(obj.Evaluations);
                });
            });

            req.on('error', function(e) {
                console.log('problem with request: ' + e.message);
            });

            // write some data to the request body
            req.write('\n');
            req.end();
        }); 
    });
}

function orarend(message, args) {
    getUserData(message, function (result) {
        getUserOrarend(message.author.id, (orarend) => {
            var week = [];
            var orak = [];

            week['Hétfő'] = moment().startOf('week').add(1, 'days').toISOString();
            week['Kedd'] = moment().startOf('week').add(2, 'days').toISOString();
            week['Szerda'] = moment().startOf('week').add(3, 'days').toISOString();
            week['Csütörtök'] = moment().startOf('week').add(4, 'days').toISOString();
            week['Péntek'] = moment().startOf('week').add(5, 'days').toISOString();
            week['Szombat'] = moment().startOf('week').add(6, 'days').toISOString();
            week['Vasárnap'] = moment().startOf('week').add(7, 'days').toISOString();


            Object.keys(week).forEach(function(key) {
                var maiorak = [];
                orarend.forEach(ora => {
                    if (moment(ora.Date).isSame(week[key])) {
                        maiorak.push(ora);
                    }
                });
                orak.push([key, maiorak]);
            });

            const orarendEmbed = new Discord.RichEmbed()
                .setColor('#1979e0')
                .setAuthor(result.Name + " - Órarend", message.author.avatarURL, '');
                
                orak.forEach(nap => {
                    napiorakstr = '';
                    nap[1].forEach(ora => {
                        napiorakstr = napiorakstr + ora.Count + " | **" + ora.Subject + "** - " + ora.ClassRoom + "\n";
                    });

                    if (napiorakstr != '') {
                        orarendEmbed.addField(nap[0], napiorakstr);
                    }
                });
                orarendEmbed.setFooter('E-Kretén', 'https://scontent-lhr3-1.cdninstagram.com/vp/ee90939bc4e85c9a2581b0ca2d3dc567/5E4AABB5/t51.2885-19/s150x150/61320441_442386149878298_396437971185696768_n.jpg?_nc_ht=scontent-lhr3-1.cdninstagram.com');

            message.channel.send(orarendEmbed);
            //console.log(result);
        });
    });
}

function getUserOrarend(dcid, callback) {
    getUserCredentials(dcid, function (result) {
        refreshToken(dcid, function (access_token) {
            var settings = result[0];    

            var URL = settings["institute_code"]+".e-kreta.hu";
            var PATH = "/mapi/api/v1/Lesson";

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
                var orarendstr='';
                res.on('data',function(chunk){
                    orarendstr+=chunk;
                });

                res.on('end',function(){
                    if (!isJsonString(orarendstr)) {
                        console.log("Hiba történt! (getUserTimetable)", orarendstr);
                        return;
                    }

                    obj=JSON.parse(orarendstr);
                    callback(obj);
                });
            });

            req.on('error', function(e) {
                console.log('problem with request: ' + e.message);
            });

            // write some data to the request body
            req.write('\n');
            req.end();
        }); 
    });
}

function insertJegyek (dcid, insert) {
    console.log("Jegyek beillesztve!");
    getUserCredentials(dcid, function (result) {
        getUserEvaluations(dcid, function (obj) {
            if (JSON.stringify(result) == "[]") {
                console.log('Nem találhatóak a felhasználó adatai a rendszerben! DCID: '+dcid);
                return;
            } else {
                var arr = [];
    
                obj.forEach(jegy => {
                    arr.push(jegy.EvaluationId);
                });
                
                console.log(arr);

                if (insert) {
                    pool.getConnection(function(err, connection) {
                        connection.query("INSERT INTO evaluations(dcid, list) VALUES("+dcid+", '"+JSON.stringify(arr)+"')");
                    });
                } else {
                    pool.getConnection(function(err, connection) {
                        connection.query("UPDATE evaluations SET list = '"+ JSON.stringify(arr) +"' WHERE dcid = "+dcid);
                    });
                }
            }
        });
    });
}

async function check() {
    console.log("check");
    while (1) {
        pool.getConnection(function(err, connection) {
            connection.query("SELECT DISTINCT dcid FROM notifications", function (err, users_result, fields) {
                if (err) throw err;

                users_result.forEach(user => {
                    getUserEvaluations(user.dcid, function (kreta_jegyek) {
                        connection.query("SELECT * FROM evaluations WHERE dcid ="+user.dcid, function (err, mentett_jegyek, fields) {
                            var uj_jegyek = "";
                            kreta_jegyek.forEach(jegy => {
                                if (!JSON.parse(mentett_jegyek[0].list).includes(jegy.EvaluationId)) {
                                    uj_jegyek += "\n" + jegy.Subject + " - " + jegy.Value;
                                }
                            });
                            if (uj_jegyek != "") {
                                connection.query("SELECT * FROM notifications WHERE dcid ="+user.dcid, function (err, user_notifications, fields) {
                                    user_notifications.forEach(notification => {
                                        connection.query("SELECT * FROM guilds WHERE guildid ="+notification.guildid, function (err, guild_result, fields) {
                                            var channel_find_result = client.channels.find("id", guild_result[0].channelid.toString())
                                            channel_find_result.send("<@"+user.dcid+"> - **Új jegyeid érkeztek!**"+uj_jegyek);
                                            insertJegyek(user.dcid);
                                        });
                                    });
                                });
                            }
                        });
                    });
                });
            });
        });
        await sleep(30 * 1000);
    }
}

function ertesitesek(message, args) {
    getGuildNotificationChannel(message.guild, function (channel) {
        if (channel == null) {
            delayDelete(message, 10000);
            message.reply("az értesítések szobája nem található. :no_entry:").then(replyMessage => {
                delayDelete(replyMessage, 10000);
            });
            return;
        }
        if ((args.length != 1) || (args[0] != "be" && args[0] != "ki")) {
            delayDelete(message, 10000);
            message.reply("hibás paramétereket adtál meg! `:ertesitesek <be/ki>`").then(replyMessage => {
                delayDelete(replyMessage, 10000);
            });
            return;
        }

        pool.getConnection(function(err, connection) {
            connection.query("SELECT * FROM notifications WHERE dcid = ? AND guildid = ?", [message.author.id, message.guild.id], function (err, result, fields) {
                if (err) throw err;
                   
                var notification_state = result.length != 0;
                
                if (args[0] == "ki") {
                    if (notification_state == false) {
                        delayDelete(message, 10000);
                        message.reply("az értesítéseid nem voltak bekapcsolva ezen a szerveren! :x:").then(replyMessage => {
                            delayDelete(replyMessage, 10000);
                        });
                    } else {
                        pool.getConnection(function(err, connection) {
                            connection.query("DELETE FROM notifications WHERE dcid = ? AND guildid = ?", [message.author.id, message.guild.id]);
                            delayDelete(message, 10000);
                            message.reply("az értesítéseket ezen a szerveren sikeresen kikapcsoltad! :white_check_mark:").then(replyMessage => {
                                delayDelete(replyMessage, 10000);
                            });
                        });
                    }
                } else if (args[0] == "be") {
                    if (notification_state == true) {
                        delayDelete(message, 10000);
                        message.reply("az értesítéseid már be vannak kapcsolva ezen a szerveren! :x:").then(replyMessage => {
                            delayDelete(replyMessage, 10000);
                        });
                    } else {
                        pool.getConnection(function(err, connection) {
                            connection.query("INSERT INTO notifications(dcid, guildid) VALUES("+message.author.id+", "+message.guild.id+")");
                            delayDelete(message, 10000);
                            message.reply("az értesítéseket ezen a szerveren sikeresen bekapcsoltad! :white_check_mark:").then(replyMessage => {
                                delayDelete(replyMessage, 10000);
                            });
                        });
                    }
                } else {
                    message.delete(); // Ha jönnek a zűrlények
                }
            });
        });
    });
}

function adatkezeles(message, args) {
    if (args.length > 1) {
        message.channel.send('Hibás paraméterek megadva! :no_entry:\n`:adatkezeles`');
    }
    if (args.length == 0) {
        message.channel.send('**Adatkezelési nyilatkozat** :newspaper:\nSemmilyen felhasználónevet vagy jelszót nem tárolunk el. Bejelentkezéskor kapunk egy azonosítót, amivel később bármikor le tudjuk kérni az e-kréta által szolgáltatott adataidat, mindaddig, amíg ki nem jelentkezel. Kijelentkezéskor minden adatod törlődik a szervereinkről.\nAz adataidat nem használjuk semmilyen célra, és nem adjuk ki harmadik félnek.\n\nAz elfogadáshoz használd az `:adatkezeles elfogad` parancsot!');
    } else if (args.length == 1 && args[0] == 'elfogad') {
        pool.getConnection(function(err, connection) {
            connection.query("INSERT INTO privacy_accepts(dcid) VALUES("+message.author.id+")");
        });
        message.channel.send('Sikeresen elfogadtad az Adatkezelési nyilatkozatot! :white_check_mark:');
    } else {
        message.channel.send('Hibás paraméterek megadva! :no_entry:\n`:adatkezeles`');
    }
}

function isAdatkezelesElfogadva(dcid, callback) {
    pool.getConnection(function(err, connection) {
        connection.query("SELECT * FROM privacy_accepts WHERE dcid = ?", [dcid], function (err, result, fields) {
            if (JSON.stringify(result) != "[]") {
                callback(true);
                return;
            }
            callback(false);
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
        jegyek(message, args);
    }
/* 
    if (command === 'ertesitesek') {
        ertesitesek(message, args);
    } */

    if (command === 'ertesitesek') {
        if (message.channel.type == "dm") {
            message.channel.send('Sajnálom, ezt a parancsot csak szerveren használhatod! :no_entry:');
            return;
        }
        ertesitesek(message, args);
    }

    if (command === 'atlag') {
        atlag(message, args);
    }

    if (command === 'orarend') {
        orarend(message, args);
    }

    if (command === 'logout') {
        if (message.channel.type != "dm") {
            message.reply('ezt a parancsot csak privátban használhatod! :no_entry:')
            .then(errorMessage => {
                delayDelete(message);
                delayDelete(errorMessage);
            });
            return;
        }
        logout(message, args);
    }
    
    if (command === 'adatkezeles') {
        if (message.channel.type != "dm") {
            message.reply('ezt a parancsot csak privátban használhatod! :no_entry:')
            .then(errorMessage => {
                delayDelete(message);
                delayDelete(errorMessage);
            });
            return;
        }
        adatkezeles(message, args);
    }
});

client.on("guildCreate", guild => {

    if (find_result = guild.channels.find("name","ekreten")) {
        pool.getConnection(function(err, connection) {
            connection.query("INSERT INTO guilds(guildid, channelid) VALUES("+guild.id+", "+find_result.id+")");
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
            connection.query("INSERT INTO guilds(guildid, channelid) VALUES("+guild.id+", "+channel.id+")");
        });
        guild.systemChannel.send("Köszi a meghívást! :smile:\nLétrehoztam az <#"+channel.id+"> nevű csatornát az értesítéseknek! :white_check_mark:");
    });
});

client.on("guildDelete", guild => {
    pool.getConnection(function(err, connection) {
        connection.query("DELETE FROM guilds WHERE guildid = ?", [guild.id]);
    });
})
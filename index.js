const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const pcj = require('phantom-chartjs');
const chartOutputDir = './charts/'
const colors = ['#0077b6', '#B80F0A', '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43', '#ffa600'];
const topUsedWordsCount = 50;
const topUsedEmojisCount = 30;

/*
TODO
    chart background (white background)
    display labels (y value above bars)
    emoji style (better emojis)
*/

Date.prototype.addDays = function (days) {
    let date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

pcj.createChartRenderer({ port: 8080 }, (err, renderer) => {
    if (err) throw err;

    function saveBase64File(base64, filename) {
        if (!fs.existsSync(chartOutputDir)) {
            fs.mkdirSync(chartOutputDir);
        }

        fs.writeFileSync(chartOutputDir + filename + '.png', base64, 'base64', (err) => { console.error('Error writing file: ' + err) });
    }

    function render(config, name, resolve, reject, startdate) {
        renderer.renderBase64(config, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve({ chartName: name, data: data, duration: new Date() - startdate });
            }
        });
    }

    async function loadData() {
        // todo file selection
        let path = await userInput('Drag and drop JSON file of Chat export:');
        return JSON.parse(fs.readFileSync(path.replace(/&|"|'/gm, ''))).messages;
    }

    function readAllMembers(data) {
        let allMembers = data.map(x => x.from).reduce(function (acc, curr) {
            if (!acc.includes(curr) && curr !== undefined) {
                acc.push(curr);
            }
            return acc;
        }, []);

        return allMembers;
    }

    function prepareUserData(members, data) {
        let preparedData = [];
        let allMessages = data.filter(x => x.type == 'message' && typeof (x.text) == 'string' && x.text.length > 0);
        let allPhotos = data.filter(x => x.type == 'message' && x.hasOwnProperty('photo'));
        let allVideos = data.filter(x => x.type == 'message' && x.hasOwnProperty('media_type') && x.media_type == 'video_file');
        let allStickers = data.filter(x => x.type == 'message' && x.hasOwnProperty('media_type') && x.media_type == 'sticker');
        let allVoiceMessages = data.filter(x => x.type == 'message' && x.hasOwnProperty('media_type') && x.media_type == 'voice_message');
        let allVideomessages = data.filter(x => x.type == 'message' && x.hasOwnProperty('media_type') && x.media_type == 'video_message');
        members.forEach(member => {
            preparedData.push(
                {
                    'name': member,
                    'messages': allMessages.filter(x => x.from == member),
                    'allWords': allMessages.filter(x => x.from == member).map(x => x.text.split(/[\s,]+/)).flat(1),
                    'photos': allPhotos.filter(x => x.from == member),
                    'videos': allVideos.filter(x => x.from == member),
                    'stickers': allStickers.filter(x => x.from == member),
                    'voice': allVoiceMessages.filter(x => x.from == member),
                    'roundvideo': allVideomessages.filter(x => x.from == member),
                    'emojis': allMessages.filter(x => x.from == member).map(x => x.text.split(/[\s,]+/)).flat(1).filter(x => x.match(/\p{EPres}|\p{ExtPict}/gu)).map(x => x.match(/\p{EPres}|\p{ExtPict}/gu)).flat(1)
                }
            )
        });
        return preparedData;
    }

    function prepareGroupCalls(data) {
        return data.filter(x => x.action == 'group_call');
    }

    async function userInput(prompt) {
        return new Promise((resolve, reject) => {
            rl.question(prompt, (answer) => {
                resolve(answer);
            })
        });
    }

    async function selectMembers(members) {
        let allMembers;

        while (allMembers == undefined || (allMembers != 'y' && allMembers != 'n')) {
            allMembers = (await userInput('Do you want to use all members of the chat [Y/N]? ')).toLowerCase();
        }

        if (allMembers == 'y') {
            return members;
        }

        let selectedMembers = [];
        for (let i = 0; i < members.length; i++) {
            let add = undefined;
            while (add == undefined || (add != 'y' && add != 'n')) {
                add = (await userInput('Add ' + members[i] + ' [Y/N]? ')).toLowerCase();
            }
            if (add == 'y') {
                selectedMembers.push(members[i]);
            }
        }
        return selectedMembers;
    }

    function chartTotalWordCount(chatData) {
        return new Promise((resolve, reject) => {
            let startdate = new Date();
            let labels = chatData.map(x => x.name);
            let data = chatData.map(x => x.allWords.length);
            let config = {
                width: 1920,
                chart: {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Total Word Count',
                            data: data,
                            backgroundColor: colors
                        }]
                    },
                    options: {
                        scales: {
                            yAxes: [{
                                ticks: {
                                    beginAtZero: true
                                }
                            }]
                        }
                    }
                }
            };

            render(config, 'words', resolve, reject, startdate);
        });
    }

    function chartTotalMessageCount(chatData) {
        return new Promise((resolve, reject) => {
            let startdate = new Date();
            let labels = chatData.map(x => x.name);
            let total = chatData.map(x => x.messages.length);
            let config = {
                width: 1920,
                chart: {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Total Messages',
                            data: total,
                            backgroundColor: colors
                        }]
                    },
                    options: {
                        scales: {
                            yAxes: [{
                                ticks: {
                                    beginAtZero: true
                                }
                            }]
                        }
                    }
                }
            };

            render(config, 'messages', resolve, reject, startdate);
        });
    }

    function chartAverageMessageCount(chatData) {
        return new Promise((resolve, reject) => {
            let startdate = new Date();
            let labels = chatData.map(x => x.name);
            let averageMessagesDay = chatData.map(function (x) {
                let messages = x.messages.length;
                let days = x.messages.map(y => new Date(new Date(y.date_unixtime * 1000).toDateString()).getTime());
                days = days.filter((y, index) => days.indexOf(y) == index).length;
                return messages / days;
            });
            let averageWordsMessage = chatData.map(x => x.allWords.length / x.messages.length);
            let config = {
                width: 1920,
                chart: {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Average messages per day',
                            data: averageMessagesDay,
                            backgroundColor: colors[0]
                        }, {
                            label: 'Average words per message',
                            data: averageWordsMessage,
                            backgroundColor: colors[1]
                        }]
                    },
                    options: {
                        scales: {
                            yAxes: [{
                                ticks: {
                                    beginAtZero: true
                                }
                            }]
                        }
                    }
                }
            };

            render(config, 'average', resolve, reject, startdate);
        });
    }

    function chartWeekDay(chatData) {
        return new Promise((resolve, reject) => {
            let startdate = new Date();
            let labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            let dataSets = [];
            chatData.forEach((memberData, memberIndex) => {
                let counter = labels.map(x => { return { weekday: x, count: 0 } });
                for (let j = 0; j < memberData.messages.length; j++) {
                    let weekday = labels[new Date(memberData.messages[j].date_unixtime * 1000).getUTCDay()]
                    counter.find(x => x.weekday == weekday).count++;
                }

                dataSets.push({
                    label: memberData.name,
                    data: counter.map(x => x.count),
                    borderColor: colors[memberIndex]
                })
            })

            let config = {
                width: 1920,
                chart: {
                    type: 'radar',
                    data: {
                        labels: labels,
                        datasets: dataSets
                    },
                    options: {
                        scale: {
                            ticks: {
                                beginAtZero: true
                            }
                        }
                    }
                }
            };

            render(config, 'week', resolve, reject, startdate);
        });
    }

    function chartFullLine(chatData) {
        return new Promise((resolve, reject) => {
            let startdate = new Date();
            let labels = [];
            let dataSets = [];

            // get min/max time
            let minTime = chatData.reduce((a, b) => a.messages.concat(b.messages || []))
                .map(message => parseInt(message.date_unixtime))
                .reduce((a, b) => Math.min(a, b)) * 1000;
            let maxTime = chatData.reduce((a, b) => a.messages.concat(b.messages || []))
                .map(message => parseInt(message.date_unixtime))
                .reduce((a, b) => Math.max(a, b)) * 1000;

            //generate labels
            let date = new Date(new Date(minTime).toDateString());
            let dateMax = new Date(new Date(maxTime).toDateString());
            while (date <= dateMax) {
                labels.push(new Date(date.toDateString()).toDateString());
                date = date.addDays(1);
            }

            chatData.forEach((memberData, memberIndex) => {
                let counter = [];
                for (let j = 0; j < memberData.messages.length; j++) {
                    let unixTime = memberData.messages[j].date_unixtime * 1000;

                    let messageDay = new Date(new Date(unixTime).toDateString()).toDateString();
                    if (counter.find(x => x.day === messageDay) == undefined) {
                        counter.push({ day: messageDay, count: 1 });
                    } else {
                        counter.find(x => x.day === messageDay).count++;
                    }
                }

                dataSets.push({
                    label: memberData.name,
                    data: labels.map(x => counter.find(y => y.day === x)?.count || 0),
                    borderColor: colors[memberIndex]
                });
            });

            let config = {
                width: 1920,
                chart: {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: dataSets
                    },
                    options: {
                        scales: {
                            yAxes: [{
                                stacked: false
                            }]
                        }
                    }
                }
            };

            render(config, 'history', resolve, reject, startdate);
        });
    }

    function chartMostUsedWords(chatData) {
        return new Promise((resolve, reject) => {
            let startdate = new Date();
            let labels = [];
            let datasets = [];

            chatData.forEach((memberData, memberIndex) => {
                let data = [];

                let wordlist = memberData.allWords;
                let occurences = [];

                wordlist.forEach(word => {
                    if (occurences.find(x => x.word == word) == undefined) {
                        occurences.push({ word: word, count: 1 });
                    } else {
                        occurences.find(x => x.word == word).count++;
                    }
                });
                occurences = occurences.sort(function (a, b) {
                    return b.count - a.count;
                });

                labels.forEach(x => data.push(0));

                for (let j = 0; j < topUsedWordsCount && occurences[j] != undefined; j++) {
                    labels.push(occurences[j].word);
                    data.push(occurences[j].count);
                }

                datasets.push({
                    label: memberData.name,
                    data: data,
                    backgroundColor: colors[memberIndex]
                });
            });

            let config = {
                width: 1920,
                chart: {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        scales: {
                            yAxes: [{
                                ticks: {
                                    beginAtZero: true
                                }
                            }]
                        }
                    }
                }
            };

            render(config, 'occurences', resolve, reject, startdate);
        });
    }

    function chartMostUsedEmojis(chatData) {
        return new Promise((resolve, reject) => {
            let startdate = new Date();
            let labels = [];
            let datasets = [];

            chatData.forEach((memberData, memberIndex) => {
                let data = [];
                let emojilist = memberData.emojis;
                let occurences = [];
                for (let j = 0; j < emojilist.length; j++) {
                    let emoji = emojilist[j];
                    if (occurences.find(x => x.emoji == emoji) == undefined) {
                        occurences.push({ emoji: emoji, count: 1 });
                    } else {
                        occurences.find(x => x.emoji == emoji).count++;
                    }
                }
                occurences = occurences.sort(function (a, b) {
                    return b.count - a.count;
                });

                for (let j = 0; j < labels.length; j++) {
                    data.push(0);
                }

                for (let j = 0; j < topUsedEmojisCount && occurences[j] != undefined; j++) {
                    labels.push(occurences[j].emoji);
                    data.push(occurences[j].count);
                }

                datasets.push({
                    label: memberData.name,
                    data: data,
                    backgroundColor: colors[memberIndex]
                });
            });

            let config = {
                width: 1920,
                chart: {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        scales: {
                            yAxes: [{
                                ticks: {
                                    beginAtZero: true
                                }
                            }]
                        }
                    }
                }
            };

            render(config, 'emojis', resolve, reject, startdate);
        });
    }

    function chartScatterActivity(chatData, groupCalls) {
        return new Promise((resolve, reject) => {
            let startdate = new Date();
            let labelsX = [];
            let labelsY = [];
            let dataPointsCalls = [];
            let datasets = [];

            // get min/max time
            let minTime = groupCalls.map(call => parseInt(call.date_unixtime)).reduce((a, b) => Math.min(a, b), Number.MAX_SAFE_INTEGER) * 1000;
            let maxTime = groupCalls.map(call => parseInt(call.date_unixtime)).reduce((a, b) => Math.max(a, b), 0) * 1000;

            chatData.forEach(memberData => {
                ['photos', 'videos', 'stickers', 'voice', 'roundvideo'].forEach(collection => {
                    memberData[collection].forEach(message => {
                        let unixTime = message.date_unixtime * 1000;
                        minTime = Math.min(unixTime, minTime);
                        maxTime = Math.max(unixTime, maxTime);
                    });
                });
            });

            //generate labels for x-axis
            let date = new Date(new Date(minTime).toDateString());
            let dateMax = new Date(new Date(maxTime).toDateString());
            while (date <= dateMax) {
                labelsX.push(new Date(date.toDateString()).toDateString());
                date = date.addDays(1);
            }

            // generate labels for y-axis
            for (let h = 23; h >= 0; h--) {
                for (let m = 59; m >= 0; m--) {
                    labelsY.push(('0' + h).slice(-2) + ':' + ('0' + m).slice(-2));
                }
            }

            // group call datapoints
            groupCalls.forEach(call => {
                let datetime = new Date(call.date_unixtime * 1000);
                let date = new Date(datetime.toDateString()).toDateString();
                let time = ('0' + datetime.getHours()).slice(-2) + ':' + ('0' + datetime.getMinutes()).slice(-2);
                dataPointsCalls.push({
                    x: date,
                    y: time
                });
            });
            datasets.push({
                label: 'Group Calls',
                data: dataPointsCalls,
                backgroundColor: colors[colors.length - 1],
                pointStyle: 'circle',
                pointRadius: 5
            })

            // media datapoints
            chatData.forEach((memberData, memberIndex) => {
                ['photos', 'videos', 'stickers', 'voice', 'roundvideo'].forEach((collection, collectionIndex) => {
                    let dataPoints = [];
                    memberData[collection].forEach(message => {
                        let datetime = new Date(message.date_unixtime * 1000);
                        let date = new Date(datetime.toDateString()).toDateString();
                        let time = ('0' + datetime.getHours()).slice(-2) + ':' + ('0' + datetime.getMinutes()).slice(-2);
                        dataPoints.push({
                            x: date,
                            y: time
                        });
                    });
                    datasets.push({
                        label: memberData.name,
                        data: dataPoints,
                        borderColor: colors[memberIndex],
                        pointStyle: ['cross', 'rectRot', 'star', 'triangle', 'crossRot'][collectionIndex],
                        pointRadius: 5
                    });
                });
            });

            let config = {
                width: 1920,
                chart: {
                    type: 'scatter',
                    data: {
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        title: {
                            display: true,
                            text: '[Photo +], [Videos ◇], [Stickers=Star], [Voicemessage △], [Round-Video x], [Calls ◯]'
                        },
                        scales: {
                            xAxes: [{
                                labels: labelsX,
                                type: 'category'
                            }],
                            yAxes: [{
                                labels: labelsY,
                                type: 'category'
                            }]
                        }
                    }
                }
            };

            render(config, 'activity', resolve, reject, startdate);
        });
    }

    function chartLineDailyActivity(chatData) {
        return new Promise((resolve, reject) => {
            let startdate = new Date();
            let labelsX = [];
            let dataSets = [];

            chatData.forEach((memberData, memberIndex) => {
                let occurences = [];
                for (let hh = 0; hh <= 23; hh++) {
                    for (let mm = 0; mm <= 45; mm += 15) {
                        let label = ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2);
                        occurences.push({
                            label: label,
                            count: 0
                        });
                        if (memberIndex == 0) {
                            labelsX.push(label);
                        }
                    }
                }
                memberData.messages.forEach(message => {
                    let messageDate = new Date(message.date_unixtime * 1000);
                    let hours = messageDate.getHours();
                    let minutes = (Math.round(messageDate.getMinutes() / 15) * 15) % 60; // round to quarter hour
                    let labelNeedle = ('0' + hours).slice(-2) + ':' + ('0' + minutes).slice(-2);
                    occurences.find(x => x.label == labelNeedle).count++;
                });

                dataSets.push({
                    label: memberData.name,
                    data: occurences.map(x => x.count),
                    borderColor: colors[memberIndex]
                });
            });

            let config = {
                width: 1920,
                chart: {
                    type: 'line',
                    data: {
                        labels: labelsX,
                        datasets: dataSets
                    },
                    options: {
                        scales: {
                            yAxes: [{
                                stacked: false
                            }]
                        }
                    }
                }
            };

            render(config, 'daily', resolve, reject, startdate);
        });
    }

    (async function main() {
        let data = await loadData();
        let members = readAllMembers(data);
        members = await selectMembers(members);
        let preparedData = prepareUserData(members, data);
        let groupCalls = prepareGroupCalls(data);
        Promise.all([
            chartTotalWordCount(preparedData),
            chartTotalMessageCount(preparedData),
            chartAverageMessageCount(preparedData),
            chartWeekDay(preparedData),
            chartFullLine(preparedData),
            chartMostUsedWords(preparedData),
            chartMostUsedEmojis(preparedData),
            chartScatterActivity(preparedData, groupCalls),
            chartLineDailyActivity(preparedData)]
        ).then(data => {
            data.forEach(x => {
                saveBase64File(x.data, x.chartName);
                console.log(`Saved chart: [${x.chartName}] [${x.duration}ms]`);
            });
        }).catch(err => {
            console.error(`Error Generating Chart!`, err);
        }).finally(() => {
            renderer.close();
            process.exit(0);
        });
    }())
});



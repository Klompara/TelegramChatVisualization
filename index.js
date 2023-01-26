const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const pcj = require('phantom-chartjs');
const chartOutputDir = './charts/'
const colors = ['#0077b6', '#B80F0A', '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43', '#ffa600'];

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

        fs.writeFileSync(chartOutputDir + filename + '.jpg', base64, 'base64', (err) => { console.error('Error writing file: ' + err) });
    }

    async function loadData() {
        // todo file selection
        let path = await userInput('Drag and drop JSON file of Chat export:');
        return JSON.parse(fs.readFileSync(path.replaceAll('& ', '').replaceAll('\'', '').replaceAll('"', ''))).messages;
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

        renderer.renderBase64(config, function (err, data) { saveBase64File(data, 'words'); console.log(`Finished total words bar chart!`); });
    }

    function chartTotalMessageCount(chatData) {
        let labels = chatData.map(x => x.name);
        let data = chatData.map(x => x.messages.length);
        let config = {
            width: 1920,
            chart: {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Total Message Count',
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

        renderer.renderBase64(config, function (err, data) { saveBase64File(data, 'messages'); console.log(`Finished total messages bar chart!`); });
    }

    function chartWeekDay(chatData) {
        let labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let dataSets = [];
        for (let i = 0; i < chatData.length; i++) {
            let counter = labels.map(x => { return { weekday: x, count: 0 } });
            for (let j = 0; j < chatData[i].messages.length; j++) {
                let weekday = labels[new Date(chatData[i].messages[j].date_unixtime * 1000).getUTCDay()]
                counter.find(x => x.weekday == weekday).count++;
            }

            dataSets.push({
                label: chatData[i].name,
                data: counter.map(x => x.count),
                borderColor: colors[i]
            })
        }
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

        renderer.renderBase64(config, function (err, data) { saveBase64File(data, 'week'); console.log(`Finished week radar chart!`); });
    }

    function chartFullLine(chatData) {
        let labels = [];
        let dataSets = [];
        let minTime = 8640000000000000;
        let maxTime = -8640000000000000;
        for (let i = 0; i < chatData.length; i++) {
            let counter = [];
            for (let j = 0; j < chatData[i].messages.length; j++) {
                let unixTime = chatData[i].messages[j].date_unixtime * 1000;

                let messageDay = new Date(new Date(unixTime).toDateString()).toDateString();
                if (counter.find(x => x.day === messageDay) == undefined) {
                    counter.push({ day: messageDay, count: 1 });
                } else {
                    counter.find(x => x.day === messageDay).count++;
                }

                // get min and max time
                minTime = minTime > unixTime ? unixTime : minTime;
                maxTime = maxTime < unixTime ? unixTime : maxTime;
            }

            dataSets.push({
                label: chatData[i].name,
                data: counter.map(x => x.count),
                borderColor: colors[i]
            });
        }

        //generate labels
        let date = new Date(new Date(minTime).toDateString());
        let dateMax = new Date(new Date(maxTime).toDateString());
        while (date <= dateMax) {
            labels.push(new Date(date.toDateString()).toDateString());
            date = date.addDays(1);
        }

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

        renderer.renderBase64(config, function (err, data) { saveBase64File(data, 'fullLine'); console.log(`Finished history line chart!`); });
    }

    function chartMostUsedWords(chatData) {
        for (let i = 0; i < chatData.length; i++) {
            let wordlist = chatData[i].allWords;
            let occurences = [];
            for (let j = 0; j < wordlist.length; j++) {
                let word = wordlist[j];
                if (occurences.find(x => x.word == word) == undefined) {
                    occurences.push({ word: word, count: 1 });
                } else {
                    occurences.find(x => x.word == word).count++;
                }
            }
            occurences = occurences.sort(function (a, b) {
                return b.count - a.count;
            });
            console.log(occurences);
        }
    }

    async function main() {
        let data = await loadData();
        let members = readAllMembers(data);
        members = await selectMembers(members);
        let preparedData = prepareUserData(members, data);
        let groupCalls = prepareGroupCalls(data);
        chartTotalWordCount(preparedData);
        chartTotalMessageCount(preparedData);
        chartWeekDay(preparedData);
        chartFullLine(preparedData);
        chartMostUsedWords(preparedData);
    }

    main()
});



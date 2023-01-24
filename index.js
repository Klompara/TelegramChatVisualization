const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const pcj = require('phantom-chartjs');
const chartOutputDir = './charts/'
const colors = ['#0077b6', '#B80F0A', '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43', '#ffa600'];

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

    function prepareData(members, data) {
        let preparedData = [];
        let allMessages = data.filter(x => x.type == 'message' && typeof (x.text) == 'string' && x.text.length > 0);
        members.forEach(member => {
            preparedData.push(
                {
                    'name': member,
                    'messages': allMessages.filter(x => x.from == member),
                    'allWords': allMessages.filter(x => x.from == member).map(x => x.text.split(/[\s,]+/)).flat(1)
                }
            )
        });
        return preparedData;
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

        renderer.renderBase64(config, function (err, data) { saveBase64File(data, 'words'); });
    }

    function chartTotalMessageCount(chatData) {
        let labels = chatData.map(x => x.name);
        let data = chatData.map(x => x.messages.length);
        let config = {
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

        renderer.renderBase64(config, function (err, data) { saveBase64File(data, 'messages'); });
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

        renderer.renderBase64(config, function (err, data) { saveBase64File(data, 'week'); });
    }

    async function main() {
        let data = await loadData();
        let members = readAllMembers(data);
        members = await selectMembers(members);
        let preparedData = prepareData(members, data);
        chartTotalWordCount(preparedData);
        chartTotalMessageCount(preparedData);
        chartWeekDay(preparedData);
    }

    main()
});



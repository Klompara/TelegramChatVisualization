const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function loadData() {
    // todo file selection
    let path = await userInput('Drag and drop JSON file of Chat export:');
    return JSON.parse(fs.readFileSync(path.replaceAll('& ', '').replaceAll('\'', ''))).messages;
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
        allMembers = await userInput('Do you want to use all members of the chat [Y/N]? ');
    }

    if(allMembers == 'y') {
        return members;
    }

    let selectedMembers = [];
    for (let i = 0; i < members.length; i++) {
        let add = undefined;
        while (add == undefined || (add != 'y' && add != 'n')) {
            add = await userInput('Add ' + members[i] + ' [Y/N]? ');
        }
        if (add == 'y') {
            selectedMembers.push(members[i]);
        }
    }
    return selectedMembers;
}

async function main() {
    let data = await loadData();
    let members = readAllMembers(data);
    members = await selectMembers(members);
    let preparedData = prepareData(members, data);
}

main();
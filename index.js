const fs = require('fs');
const Prompt = require('prompt-checkbox');

function loadData() {
    // todo file selection
    return JSON.parse(fs.readFileSync(process.argv[2])).messages;
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

async function userSelectMembers(members) {
    return new Promise((resolve, reject) => {
        var prompt = new Prompt({
            name: 'Members',
            message: 'Which group member should be included? (navigate with arrow keys, select with space and enter to continue)',
            choices: members
        });

        prompt.ask(function (answers) {
            if(answers.length == 0) {
                process.exit(0);
            }
            resolve(answers);
        });
    });
}

async function main() {
    let data = loadData();
    let members = readAllMembers(data);
    members = await userSelectMembers(members);
    let preparedData = prepareData(members, data);
    console.log(`preparedData`, preparedData);
}

main();
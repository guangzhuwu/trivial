import fs from "fs/promises";
import fetch from "node-fetch";
import {createWriteStream} from "fs";

const BATCH_SIZE = 50;
const API_ENDPOINT = "https://artofproblemsolving.com/wiki/api.php";

const memoize = (fn) => {
    const cache = new Map();
    return (arg) => {
        if (!cache.has(arg)) {
            cache.set(arg, fn(arg));
        }
        return cache.get(arg);
    };
};

const validProblem = memoize((problem) =>
    /^\d{4}[\s_].*[\s_][Pp]roblems\/[Pp]roblem[_\s]\D*\d+$/.test(problem)
);

const computeTest = memoize((problem) =>
    problem.match(/(\d{4}[\s_])(.*)([\s_][Pp]roblems)/)[2]
        .replace(/AMC (10|12)[A-Z]/, "AMC $1")
        .replace(/AIME I+/, "AIME")
        .replace(/AJHSME/, "AMC 8")
);

const computeYear = memoize((problem) => problem.match(/^\d{4}/)[0]);
const computeNumber = memoize((problem) => problem.match(/\d+$/)[0]);

const sortProblems = (problems) => [...problems].sort((a, b) =>
    Math.sign(computeYear(a) - computeYear(b)) ||
    computeTest(a).localeCompare(computeTest(b)) ||
    Math.sign(computeNumber(a) - computeNumber(b))
);

const fetchPages = async () => {
    const allPages = new Set();
    const allProblems = new Set();
    let json = null;
    const params = `action=query&list=allpages&aplimit=max&format=json`;

    do {
        const paramsContinue = params + (json?.continue ? `&apcontinue=${json.continue.apcontinue}` : '');
        const response = await fetch(`${API_ENDPOINT}?${paramsContinue}&origin=*`);
        json = await response.json();

        for (let page of json?.query.allpages) {
            if (page.title.charAt(0) !== "/") {
                allPages.add(page.title);
                if (validProblem(page.title)) {
                    allProblems.add(page.title);
                }
            }
        }

        console.log(`${Math.round((allPages.size / 16000) * 100)}% loaded...`);
    } while (json?.continue);

    return {allPages: [...allPages], allProblems: sortProblems(allProblems)};
};

const streamWrite = (filename, data) => {
    return new Promise((resolve, reject) => {
        const writeStream = createWriteStream(filename);
        writeStream.write(JSON.stringify(data, null, 2));
        writeStream.end();
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
};

(async () => {
    try {
        const {allPages, allProblems} = await fetchPages();

        await Promise.all([
            streamWrite('data/allpages.json', allPages),
            streamWrite('data/allproblems.json', allProblems)
        ]);

        const roundedLength = Math.ceil(allPages.length / 500) * 500;
        const code = (await fs.readFile('downloadlists.js', 'utf8'))
            .replace(/let numPages = \d*?;/, `let numPages = ${roundedLength};`);

        await fs.writeFile('downloadlists.js', code);

    } catch (err) {
        console.error('Error:', err);
    }
})();

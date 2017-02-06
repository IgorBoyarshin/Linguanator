import { WordsOfLanguage } from './words-of-language';
import { Connection } from './connection';
import { Word } from './word';

class WordInProgress {
    w: string;
    cc: number;
    fcd: { y: number; m: number; d: number; };
    tr: string[];
    s: string;
    t: string;
}

class WordLearned {
    w: string;
    tr: string[];
    s: string;
    t: string;
}

class Ger {
    inProgress: WordInProgress[];
    learned: WordLearned[];
}

export class OldDatabaseLoader {
    private wordsGer: WordsOfLanguage = new WordsOfLanguage();
    private wordsEng: WordsOfLanguage = new WordsOfLanguage();
    private wordsRus: WordsOfLanguage = new WordsOfLanguage();
    private conn: Connection[][][] = [];

    getWordsGer(): WordsOfLanguage {
        return this.wordsGer;
    }

    getWordsEng(): WordsOfLanguage {
        return this.wordsEng;
    }

    getWordsRus(): WordsOfLanguage {
        return this.wordsRus;
    }

    getConnections(): Connection[][][] {
        return this.conn;
    }

    constructor(json: any) {
        const db = json as Ger;
        
        this.wordsGer.words = [];
        this.wordsEng.words = [];
        this.wordsRus.words = [];
        this.conn.push([[], [], []]);
        this.conn.push([[], [], []]);
        this.conn.push([[], [], []]);
        this.conn[0][0] = [];
        this.conn[0][1] = []; // Ger -> Eng
        this.conn[0][2] = [];
        this.conn[1][0] = []; // Eng -> Ger
        this.conn[1][1] = [];
        this.conn[1][2] = [];
        this.conn[2][0] = []; // From rus
        this.conn[2][1] = []; // From rus
        this.conn[2][2] = []; // From rus

        this.wordsGer.nextIdToUse = 0;
        this.wordsEng.nextIdToUse = 0;
        this.wordsRus.nextIdToUse = 0;

        db.learned.map(wordGer => {
            const scoreToSet: number = 25.0;
            const gerId: number = this.wordsGer.nextIdToUse++;
            let newGerWord: Word = new Word(gerId, wordGer.w, scoreToSet, [wordGer.t]);
            this.wordsGer.words.push(newGerWord);

            this.conn[0][1].push(new Connection(gerId, []));

            wordGer.tr.forEach(engWordStr => {
                let engWord: Word = this.wordsEng.words.find(word => word.w == engWordStr);
                if (engWord) {
                    // Word itself
                    engWord.s = +(Math.floor((engWord.s + scoreToSet - 5.0) / 2.0 * 100.0) / 100.0).toFixed(2);
                    if (!engWord.t.includes(wordGer.t)) {
                        engWord.t.push(wordGer.t);
                    }

                    // connections
                    this.conn[1][0].find(connection => connection.from == engWord.id).to.push(gerId);
                    this.conn[0][1].find(connection => connection.from == gerId).to.push(engWord.id);
                } else {
                    const id: number = this.wordsEng.nextIdToUse++;
                    engWord = new Word(id, engWordStr, scoreToSet - 5.0, [wordGer.t]);
                    this.wordsEng.words.push(engWord);

                    // connections
                    this.conn[1][0].push(new Connection(id, [gerId]));
                    this.conn[0][1].find(connection => connection.from == gerId).to.push(id);
                }
            });
        });

        db.inProgress.map(wordGer => {
            const gerId: number = this.wordsGer.nextIdToUse++;
            let newGerWord: Word = new Word(gerId, wordGer.w, 1.0 * wordGer.cc, [wordGer.t]);
            this.wordsGer.words.push(newGerWord);

            this.conn[0][1].push(new Connection(gerId, []));

            wordGer.tr.forEach(engWordStr => {
                let engWord: Word = this.wordsEng.words.find(word => word.w == engWordStr);
                if (engWord) {
                    // Word itself
                    engWord.s = +(Math.floor((engWord.s + 1.0 * wordGer.cc) / 2.0 * 100.0) / 100.0).toFixed(2);
                    if (!engWord.t.includes(wordGer.t)) {
                        engWord.t.push(wordGer.t);
                    }

                    // connections
                    this.conn[1][0].find(connection => connection.from == engWord.id).to.push(gerId);
                    this.conn[0][1].find(connection => connection.from == gerId).to.push(engWord.id);
                } else {
                    const id: number = this.wordsEng.nextIdToUse++;
                    engWord = new Word(id, engWordStr, +(Math.floor(1.0 * wordGer.cc * 0.75 * 100.0) / 100.0).toFixed(2), [wordGer.t]);
                    this.wordsEng.words.push(engWord);

                    // connections
                    this.conn[1][0].push(new Connection(id, [gerId]));
                    this.conn[0][1].find(connection => connection.from == gerId).to.push(id);
                }
            });
        });
    }
}
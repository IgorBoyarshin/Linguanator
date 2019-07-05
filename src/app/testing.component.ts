import { Component, OnInit } from '@angular/core';
import { DatabaseService } from './database.service';

import { Word } from './word';
import { Language } from './language';
import { Connection } from './connection';

@Component({
    selector: 'testing',
    templateUrl: './testing.component.html',
    host: {
        '(document:keydown)': 'handleKeyPress($event)'
    }
})
export class TestingComponent implements OnInit {

    private db: DatabaseService;

    private languagePairToUse: number[] = [];
    private currentLanguageFrom: Language;
    private currentLanguageTo: Language;
    private currentLanguageIndexFrom: number;
    private currentLanguageIndexTo: number;

    private userInput: string = "";
    private currentWord: Word;
    private correctTranslations: Word[] = [];
    private answerScore: number = 0.0;

    // private showingAnswerState: boolean = false;
    private stateUserInput: number = 0;
    private stateWrongAnswer: number = 1;
    private stateAlmostCorrectAnswer: number = 2;
    private stateCorrectAnswer: number = 3;
    private currentState: number = this.stateUserInput;

    private sortedWordsIndices: number[][] = []; // [lang][indexOfWordIndex]
    private indexOfCurrentWordIndex: number;

    private untilNextDump: number = 0;

    constructor(databaseService: DatabaseService) {
        this.db = databaseService;      
    }

    ngOnInit(): void {
        this.db.init()
            .then(() => this.onDatabaseLoad());
    }

    private onDatabaseLoad(): void {
        this.untilNextDump = this.db.settings.dumpFrequency;

        this.languagePairToUse = [
            this.db.testingLanguageFrom,
            this.db.testingLanguageTo
            // this.db.getLanguageIndexByLabel('ger'),
            // this.db.getLanguageIndexByLabel('eng')
        ];

        if (this.db.tagsToUse.length == 0) {
            this.db.useAllTags();
        }

        // Will contain only the two languages specified in the langPair, others will be undefined
        // Will contain only those words that have non-zero translations[] in the other language        
        this.sortedWordsIndices = this.db.getLanguages()
            .map((lang, index) => index)
            .map(langIndex => this.languagePairToUse.includes(langIndex) ? this.db.wordsOfLanguages[langIndex].words : [])
            .map((words, languageIndex) => {
                const langIndexFrom = languageIndex;
                const langIndexTo = languageIndex == this.languagePairToUse[0] ? this.languagePairToUse[1] : this.languagePairToUse[0];
                return this.range(0, words.length)
                    // only words with needed tags
                    .filter(index => {
                        const tagsOfWord: string[] = words[index].t;

                        // the word has at least one of the needed tags
                        // TODO: mb swap arrays, bm it will be faster
                        return this.db.tagsToUse.some(tag => tagsOfWord.includes(tag));
                    })
                    // the word has translation for given language pair
                    .filter(index => !this.db.isConnectionEmpty(langIndexFrom, langIndexTo, words[index].id));
            })
            .map((indices, languageIndex) => {
                const words: Word[] = this.db.wordsOfLanguages[languageIndex].words;
                return indices.sort((i1, i2) => words[i1].s - words[i2].s);
            });

        this.setup();
    }

    private dumpChanges(): void {
        this.db.saveProgress();
    }

    private setup(): void {
        this.currentWord = this.generateWord();
        if (this.currentWord == undefined) {
            // generateWord() returns undefined when there are no words that meet 
            // the required condition(given langs pair and given tagsToUse)

            // So we can do nothing,just notify the user that he has to change the condition            
            this.correctTranslations = [];
            return;
        }

        this.correctTranslations = this.getCorrectTranslations(
            this.currentLanguageIndexFrom, this.currentLanguageIndexTo, this.currentWord);
    }

    private handleKeyPress(event: KeyboardEvent): void {
        if (event.keyCode == 13) {
            if (this.currentState > this.stateUserInput) {
                this.submitAnswer();

                setTimeout(() => document.getElementById("user-answer").focus(), 80);
                event.stopPropagation();
            }
        }
    }

    private submitAnswer(): void {
        if (this.currentState == this.stateUserInput) {
            if (this.userInput.trim().length > 0) {
                this.userInput = this.userInput.trim();

                const parsedAnswer: { wordIndex: number, presenceScore: number }[] =
                    this.parseAnswer(this.userInput.split(';'), this.correctTranslations.map(word => word.w));

                // console.log("Parsed: " + parsedAnswer + " of " + this.correctTranslations.length);
                // console.log("Delta: " + scoreDelta);

                const amountOfCorrect = parsedAnswer
                    .map(obj => obj.presenceScore)
                    .reduce((acc, curr) => acc += (curr == 2 ? 1 : 0), 0);
                const amountOfAlmostCorrect = parsedAnswer
                    .map(obj => obj.presenceScore)
                    .reduce((acc, curr) => acc += (curr == 1 ? 1 : 0), 0);
                const amountOfWrong = parsedAnswer.length - amountOfCorrect - amountOfAlmostCorrect;

                const scoreDelta: number = this.evaluateAnswer(amountOfWrong, amountOfAlmostCorrect + amountOfCorrect);
                this.answerScore = scoreDelta;

                if (amountOfCorrect + amountOfAlmostCorrect < amountOfWrong) {
                    this.currentState = this.stateWrongAnswer;
                } else {
                    if (amountOfAlmostCorrect > 0) {
                        this.currentState = this.stateAlmostCorrectAnswer;
                    } else {
                        this.currentState = this.stateCorrectAnswer;
                    }
                }

                // Update the word itself
                this.updateWordScore(this.indexOfCurrentWordIndex, scoreDelta);

                // Update its translations that the user guessed correctly
                const scoreDeltaForTranslation: number = scoreDelta / 2.0;
                parsedAnswer
                    .filter(obj => obj.presenceScore > 0) // only the correct ones get updated
                    .map(obj => obj.wordIndex)
                    .map(wordIndex => // wordIndex - index in the correctTranslations[]
                        this.db.getWordIndexById(this.currentLanguageIndexTo, this.correctTranslations[wordIndex].id)
                    )
                    .forEach(wordIndex => this.db.updateWordScore(this.currentLanguageIndexTo, wordIndex, scoreDeltaForTranslation));

            }
        } else {
            this.currentState = this.stateUserInput;
            this.userInput = "";

            if (this.untilNextDump == 1) {
                this.untilNextDump = this.db.settings.dumpFrequency;
                this.dumpChanges();
            } else {
                this.untilNextDump--;
            }

            this.setup();
        }
    }

    // Returns the score delta
    private evaluateAnswer(wrong: number, correct: number): number {
        return this.db.round(Math.pow(correct, 3.0 / 4.0) - wrong);
        // return +(Math.floor((Math.pow(correct, 3.0 / 4.0) - wrong) * 100.0) / 100.0).toFixed(2);
    }

    // Returns an array
    // For each word: 0 - not present, 1 - present with mistake, 2 - perfect match
    private parseAnswer(userAnswer: string[], correctAnswer: string[]): { wordIndex: number, presenceScore: number }[] {
        return userAnswer.map(answer => this.evaluatePresence(answer, correctAnswer));
    }

    // 0 - not present, 1 - present with mistake, 2 - perfect match
    private evaluatePresence(str: string, array: string[]): { wordIndex: number, presenceScore: number } {

        let index: number;

        index = array.findIndex(value => value == str);
        if (index >= 0) {
            return { wordIndex: index, presenceScore: 2 };
        }

        index = array.findIndex(value => this.isWithinError(str, value));
        if (index >= 0) {
            return { wordIndex: index, presenceScore: 1 };
        }

        return { wordIndex: undefined, presenceScore: 0 };

        // if (array.includes(str)) {
        //     return 2;
        // } else if (array.some(element => this.isWithinError(str, element))) {
        //     return 1;
        // } else {
        //     return 0;
        // }
    }

    private isWithinError(str1: string, str2: string): boolean {
        // let lCorrect = correctWord.toLowerCase();
        // let lUsed = usedWord.toLowerCase();

        if (str1 == str2) {
            return true;
        }

        if (str1.length == str2.length) {
            let mistakeFound: boolean = false;

            for (let i = 0; i < str1.length; i++) {
                if (str1.charAt(i) != str2.charAt(i)) {
                    if (mistakeFound) {
                        return false;
                    }

                    mistakeFound = true;
                }
            }

            return true;
        }

        if (str1.length == str2.length - 1) {
            return this.isStrPartOf(str1, str2);
        } else if (str1.length == str2.length + 1) {
            return this.isStrPartOf(str2, str1);
        }

        return false;
    }

    private isStrPartOf(subStr: string, str: string): boolean {
        let missFound = false;

        for (let i = 1; i <= subStr.length; i++) {
            if (subStr.charAt(i - 1) != str.charAt(missFound ? (i + 1 - 1) : (i - 1))) {
                if (missFound) {
                    return false;
                }

                i--;
                missFound = true;
            }
        }

        return true;
    }

    private updateWordScore(indexOfWordIndex: number, scoreDelta: number): void {
        // Set through database, so that the database can keep track of the changes to it        

        const indices: number[] = this.sortedWordsIndices[this.currentLanguageIndexFrom];
        const newScore: number = this.db.updateWordScore(this.currentLanguageIndexFrom,
            this.sortedWordsIndices[this.currentLanguageIndexFrom][indexOfWordIndex], scoreDelta);

        let newIndexOfWordIndex: number = indexOfWordIndex;
        if (scoreDelta > 0) {
            if (newIndexOfWordIndex + 1 < indices.length) {
                // Redundant movement through equal ones
                while (this.db.wordsOfLanguages[this.currentLanguageIndexFrom].words[indices[newIndexOfWordIndex + 1]].s <= newScore) {
                    newIndexOfWordIndex++;
                    if (newIndexOfWordIndex + 1 >= indices.length) {
                        break;
                    }
                }
            }

            this.sortedWordsIndices[this.currentLanguageIndexFrom] = [].concat(
                indices.slice(0, indexOfWordIndex),
                indices.slice(indexOfWordIndex + 1, newIndexOfWordIndex + 1),
                indices[indexOfWordIndex], // the index itself
                indices.slice(newIndexOfWordIndex + 1)
            );
            // console.log(this.sortedWordsIndices[this.currentLanguageIndexFrom]
            //     .map(i => this.db.wordsOfLanguages[this.currentLanguageIndexFrom].words[i]).map(w => w.w + " : " + w.s));
        } else if (scoreDelta < 0) {
            if (newIndexOfWordIndex - 1 >= 0) {
                // Redundant movement through equal ones
                while (this.db.wordsOfLanguages[this.currentLanguageIndexFrom].words[indices[newIndexOfWordIndex - 1]].s >= newScore) {
                    newIndexOfWordIndex--;
                    if (newIndexOfWordIndex - 1 < 0) {
                        break;
                    }
                }
            }

            this.sortedWordsIndices[this.currentLanguageIndexFrom] = [].concat(
                indices.slice(0, newIndexOfWordIndex),
                indices.slice(newIndexOfWordIndex + 1, indexOfWordIndex + 1),
                indices[newIndexOfWordIndex], // the index itself
                indices.slice(indexOfWordIndex + 1)
            );
        }
    }

    private getCorrectTranslations(languageIndexFrom: number, languageIndexTo: number,
        word: Word): Word[] {

        // console.log(this.db.getConnectionByFromId(languageIndexFrom, languageIndexTo, word.id));        

        return this.db.getConnectionByFromId(languageIndexFrom, languageIndexTo, word.id)
            .to
            .map(id => this.db.getWordById(languageIndexTo, id));
    }

    private generateWord(): Word {
        if (this.db.isTestingBothWays) {
            this.currentLanguageIndexFrom = this.generateLanguageIndex();
            this.currentLanguageIndexTo = this.generateLanguageIndex(this.currentLanguageIndexFrom);
        } else {
            this.currentLanguageIndexFrom = this.languagePairToUse[0];
            this.currentLanguageIndexTo = this.languagePairToUse[1];
        }
        this.currentLanguageFrom = this.db.getLanguage(this.currentLanguageIndexFrom);
        this.currentLanguageTo = this.db.getLanguage(this.currentLanguageIndexTo);

        const words: Word[] = this.db.wordsOfLanguages[this.currentLanguageIndexFrom].words;
        const amountOfWords: number = this.sortedWordsIndices[this.currentLanguageIndexFrom].length; // <=(LE) than words[lang].length
        if (amountOfWords == 0) {
            // It means that for given lang pair and given tagsToUse 
            // there are no words that meet the condition
            return undefined;
        }
        this.indexOfCurrentWordIndex = Math.floor(this.generateExponential(amountOfWords));

        return words[this.sortedWordsIndices[this.currentLanguageIndexFrom][this.indexOfCurrentWordIndex]];
    }

    // TODO: can verbessern
    private generateLanguageIndex(exceptFor: number = undefined): number {
        let index: number;
        do {
            index = this.languagePairToUse[this.generateRandomInt(this.languagePairToUse.length)];
        } while (index == exceptFor);

        return index;
    }

    private generateExponential(max: number): number {
        const intensity: number = 3.5 / max; // higher => more strict

        return (max * Math.pow(Math.E, intensity * (this.generateRandomFloat(max) - max)) - max * Math.pow(Math.E, -1.0 * intensity * max));
    }

    private generateRandomInt(upperBound: number = 1.0): number {
        return Math.floor(Math.random() * upperBound);
    }

    private generateRandomFloat(upperBound: number = 1.0): number {
        return (Math.random() * upperBound);
    }

    /**
     * Generater an array containing integers in range [min; max)
     */
    private range(min: number = 0, max: number): number[] {
        let a: number[] = Array.apply(null, Array(max));
        return a.map((_, i) => i + min);
    }
}

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

    // private showingAnswerState: boolean = false;
    private stateUserInput: number = 0;
    private stateWrongAnswer: number = 1;
    private stateAlmostCorrectAnswer: number = 2;
    private stateCorrectAnswer: number = 3;
    private currentState: number = this.stateUserInput;    

    private sortedWordsIndices: number[][] = []; // [lang][indexOfWordIndex]
    private indexOfCurrentWordIndex: number;

    constructor(databaseService : DatabaseService) {
        this.db = databaseService;
    }

    ngOnInit(): void {        
        this.db.init()
            .then(() => this.onDatabaseLoad());
    }

    private onDatabaseLoad(): void {
        this.languagePairToUse = [
            this.db.getLanguageIndexByLabel('ger'),
            this.db.getLanguageIndexByLabel('eng')
        ];
        
        // Will contain only the two languages specified in the langPair, others will be undefined
        // Will contain only those words that have non-zero translations[] in the other language
        this.sortedWordsIndices = this.db.getLanguages()
            .map((lang, index) => index)
            .map(langIndex => this.languagePairToUse.includes(langIndex) ? this.db.wordsOfLanguages[langIndex] : undefined)
            .map(words => words ? words.words : [])
            .map((words, index) => {
                const langIndexFrom = index;
                const langIndexTo = index == this.languagePairToUse[0] ? this.languagePairToUse[1] : this.languagePairToUse[0];                
                return words.filter(word => !this.db.isConnectionEmpty(langIndexFrom, langIndexTo, word.id));
            })
            .map(words => this.range(0, words.length).sort((i1, i2) => words[i1].s - words[i2].s));

        
        this.setup();
    }


    private setup(): void {
        this.currentWord = this.generateWord();
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

                const parsedAnswer: number[] = 
                    this.parseAnswer(this.userInput.split(';'), this.correctTranslations.map(word => word.w));
                
                const scoreDelta = this.evaluateAnswer(parsedAnswer);
                // console.log("Parsed: " + parsedAnswer + " of " + this.correctTranslations.length);
                // console.log("Delta: " + scoreDelta);

                const amountOfCorrect = parsedAnswer.reduce((acc, curr) => acc += (curr == 2 ? 1 : 0), 0);
                const amountOfAlmostCorrect = parsedAnswer.reduce((acc, curr) => acc += (curr == 1 ? 1 : 0), 0);
                const amountOfWrong = parsedAnswer.length - amountOfCorrect - amountOfAlmostCorrect;
                if (amountOfCorrect + amountOfAlmostCorrect < amountOfWrong) {
                    this.currentState = this.stateWrongAnswer;
                } else {
                    if (amountOfAlmostCorrect > 0) {
                        this.currentState = this.stateAlmostCorrectAnswer;
                    } else {
                        this.currentState = this.stateCorrectAnswer;
                    }
                }        

                this.updateWordScore(this.indexOfCurrentWordIndex, scoreDelta);
            }
        } else {
            this.currentState = this.stateUserInput;
            this.userInput = "";
            this.setup();
        }        
    }

    // Returns the score delta
    private evaluateAnswer(parsedAnswer: number[]): number {
        if (parsedAnswer.some(value => value >= 1)) {
            return 1.0;
        } else {
            return -1.0;
        }
    }

    // Returns an array
    // For each word: 0 - not present, 1 - present with mistake, 2 - perfect match
    private parseAnswer(userAnswer: string[], correctAnswer: string[]): number[] {
        return userAnswer.map(answer => this.evaluatePresence(answer, correctAnswer));
    }

    // 0 - not present, 1 - present with mistake, 2 - perfect match
    private evaluatePresence(str: string, array: string[]): number {
        if (array.includes(str)) {
            return 2;
        } else if (array.some(element => this.isWithinError(str, element))) {
            return 1;
        } else {
            return 0;
        }
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
            if (subStr.charAt(i - 1) != str.charAt(missFound ? (i+1 - 1) : (i - 1))) {
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
        this.currentLanguageIndexFrom = this.generateLanguageIndex();
        this.currentLanguageIndexTo = this.generateLanguageIndex(this.currentLanguageIndexFrom);
        this.currentLanguageFrom = this.db.getLanguage(this.currentLanguageIndexFrom);
        this.currentLanguageTo = this.db.getLanguage(this.currentLanguageIndexTo);
        
        const words: Word[] = this.db.wordsOfLanguages[this.currentLanguageIndexFrom].words;
        const amountOfWords: number = this.sortedWordsIndices[this.currentLanguageIndexFrom].length; // <= than words[lang]
        this.indexOfCurrentWordIndex = Math.floor(this.generateExponential(amountOfWords));        

        return words[this.sortedWordsIndices[this.currentLanguageIndexFrom][this.indexOfCurrentWordIndex]];
    }

    private generateLanguageIndex(exceptFor: number = undefined): number {        
        let index: number;
        do {
            index = this.languagePairToUse[this.generateRandomInt(this.languagePairToUse.length)];            
        } while (index == exceptFor);
        
        return index;
    }    

    private generateExponential(max: number): number {
        const intensity: number = 3.5 / max; // higher => more strict

        return (max * Math.pow(Math.E, intensity * (this.generateRandomFloat(max) - max)) - Math.pow(Math.E, -1.0 * intensity * max));
    }

    private generateRandomInt(upperBound: number = 1.0): number {
        return Math.floor(Math.random() * upperBound);
    }

    private generateRandomFloat(upperBound: number = 1.0): number {
        return (Math.random() * upperBound);
    }

    private range(min: number = 0, max: number): number[] {
        let a: number[] = Array.apply(null, Array(max));
        return a.map((_, i) => i + min);        
    }
}

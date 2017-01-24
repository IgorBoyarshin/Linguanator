import { Component, OnInit } from '@angular/core';
import { DatabaseService } from './database.service';

import { Word } from './word';
import { Language } from './language';
import { Connection } from './connection';

@Component({
    selector: 'testing',
    templateUrl: './testing.component.html'
})
export class TestingComponent implements OnInit {

    private db: DatabaseService;

    private languagesToUse: number[] = [];
    private currentLanguageFrom: Language;
    private currentLanguageTo: Language;
    private currentLanguageIndexFrom: number;
    private currentLanguageIndexTo: number;

    private userInput: string;
    private currentWord: Word;

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
        this.languagesToUse = [
            this.db.getLanguageIndexByLabel('ger'),
            this.db.getLanguageIndexByLabel('eng')
        ];
        
        this.sortedWordsIndices = this.db.getLanguages()
            .map((lang, index) => index)                        
            .map(langIndex => this.languagesToUse.includes(langIndex) ? this.db.wordsOfLanguages[langIndex] : undefined)            
            .map(words => words ? words.words : [])
            .map(words => this.range(0, words.length).sort((i1, i2) => words[i1].s - words[i2].s)); 

        this.currentWord = this.generateWord();       
    }




    private submitAnswer() {        
        this.currentWord = this.generateWord();
        const connection: Connection = 
            this.db.getConnectionByFromId(this.currentLanguageIndexFrom, this.currentLanguageIndexTo, this.currentWord.id);

        this.updateWordScore(this.indexOfCurrentWordIndex, +1.0);
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
                    if (newIndexOfWordIndex - 1 >= 0) {
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

    private generateWord(): Word {
        this.currentLanguageIndexFrom = this.generateLanguageIndex();
        this.currentLanguageIndexTo = this.generateLanguageIndex(this.currentLanguageIndexFrom);
        this.currentLanguageFrom = this.db.getLanguage(this.currentLanguageIndexFrom);
        this.currentLanguageTo = this.db.getLanguage(this.currentLanguageIndexTo);
        
        const words: Word[] = this.db.wordsOfLanguages[this.currentLanguageIndexFrom].words;
        const amountOfWords: number = words.length;          
        this.indexOfCurrentWordIndex = Math.floor(this.generateExponential(amountOfWords));        

        return words[this.sortedWordsIndices[this.currentLanguageIndexFrom][this.indexOfCurrentWordIndex]];
    }

    private generateLanguageIndex(exceptFor: number = undefined): number {        
        let index: number;
        do {
            index = this.languagesToUse[this.generateRandomInt(this.languagesToUse.length)];            
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

import { Component } from '@angular/core';
import { DatabaseService } from './database.service';
import { OnInit } from '@angular/core';

import { Word } from './word';
import { Language } from './language';
import { Connection } from './connection';

@Component({
    selector: 'database',
    templateUrl: './database.component.html'
})
export class DatabaseComponent implements OnInit {

    private db: DatabaseService;

    private languageIndexFrom: number;
    private languageIndexTo: number;
    private languageNameFrom: string;
    private languageNameTo: string;
    private allLanguages: Language[];

    private words: Word[] = [];
    private translations: Word[][];    

    private isOpenFrom: boolean = false;
    private isOpenTo: boolean = false; 

    private inputWord: string;
    private inputTranslations: string;
    private inputTags: string;

    private idOfWordBeingEdited: number = undefined;

    private isTableLoading = true;

    constructor(databaseService: DatabaseService) { 
        this.db = databaseService;
    }

    ngOnInit(): void {        
        this.db.init()
            .then(() => this.onDatabaseLoad());
    }

    private onDatabaseLoad(): void {                              
        // Starting languages
        this.languageIndexFrom = this.db.getLanguageIndexByLabel("ger"); // TODO: change
        this.languageIndexTo = this.db.getLanguageIndexByLabel("eng"); // TODO: change        
        
        this.allLanguages = this.db.settings.languages.registeredLanguages;

        this.loadContent();               
    }

    private loadContent(): void {        
        this.languageNameFrom = this.db.getLanguage(this.languageIndexFrom).name;
        this.languageNameTo = this.db.getLanguage(this.languageIndexTo).name;        
        
        const wordsTo = this.db.wordsOfLanguages[this.languageIndexTo].words;

        // Words appear only if they have non-empty translation in that language        
        this.words = [];
        this.translations = [];        
        let words: Word[] = [];
        let emptyWords: Word[] = [];        
        // const connections: Connection[] = this.db.connections[this.languageIndexFrom][this.languageIndexTo];
        this.db.wordsOfLanguages[this.languageIndexFrom].words
            .forEach((word, index) => {
                const connection: Connection = this.db.getConnectionByFromId(
                        this.languageIndexFrom, this.languageIndexTo, word.id);

                // Exists at all for this pair of langs, and is not empty
                if (connection && connection.to.length > 0) {
                    words.push(word);
                    this.translations.push(connection.to.map(id => wordsTo.find(word => word.id == id)));
                } else {
                    emptyWords.push(word);
                    
                }              
            });

        emptyWords.forEach(word => words.push(word));    

        const amountOfDummyWordsToDisplayBeforeTheRestLoads = 20;
        this.words = words.slice(0, amountOfDummyWordsToDisplayBeforeTheRestLoads);
        setTimeout(() => {this.words = words; this.isTableLoading = false}, 10);
    }



    private showDB(): void {        
        console.log("");
        console.log("<<>> WORDS GER <<>>");
        console.log(this.db.wordsOfLanguages[0].words.map(word => "" + word.id + " : " + word.w));

        console.log("");
        console.log("<<>> WORDS ENG <<>>");
        console.log(this.db.wordsOfLanguages[1].words.map(word => "" + word.id + " : " + word.w));

        console.log("");
        console.log("<<>> WORDS RUS <<>>");
        console.log(this.db.wordsOfLanguages[2].words.map(word => "" + word.id + " : " + word.w));

        console.log("");
        console.log("<<>> CONNECTIONS GER -> ENG <<>>");
        console.log(this.db.connections[0][1].map(conn => "" + conn.from + " -> " + conn.to.join(", ")));        

        console.log("");
        console.log("<<>> CONNECTIONS ENG -> GER <<>>");
        console.log(this.db.connections[1][0].map(conn => "" + conn.from + " -> " + conn.to.join(", ")));        

        console.log("");
        console.log("<<>> CONNECTIONS GER -> RUS <<>>");
        console.log(this.db.connections[0][2].map(conn => "" + conn.from + " -> " + conn.to.join(", ")));

        console.log("");
        console.log("<<>> CONNECTIONS RUS -> GER <<>>");
        console.log(this.db.connections[2][0].map(conn => "" + conn.from + " -> " + conn.to.join(", ")));

        console.log("");
        console.log("<<>> CONNECTIONS ENG -> RUS <<>>");
        console.log(this.db.connections[1][2].map(conn => "" + conn.from + " -> " + conn.to.join(", ")));

        console.log("");
        console.log("<<>> CONNECTIONS RUS -> ENG <<>>");
        console.log(this.db.connections[2][1].map(conn => "" + conn.from + " -> " + conn.to.join(", ")));
    }

    private dumpChangesToDatabase(): void {
        this.db.saveProgress();
    }  

    // Called by the button
    private editWord(word: Word, wordIndex: number): void {        
        this.inputWord = word.w;
        this.inputTranslations = this.translations[wordIndex] ? 
            this.translations[wordIndex].map(word => word.w).join(";") : "";
        // this.inputTranslations = this.db
        //     .getConnectionByFromId(this.languageIndexFrom, this.languageIndexTo, word.id)
        //     .to
        //     .map(id => this.);
        this.inputTags = word.t.join(";");
        this.idOfWordBeingEdited = word.id;

        this.loadContent();

        this.dumpChangesToDatabase();
    }

    // Called by the button
    private removeWord(word: Word): void {       
        this.db.deleteWord(this.languageIndexFrom, this.languageIndexTo, 
            this.db.getWordIndexById(this.languageIndexFrom, word.id));        

        this.loadContent();

        this.dumpChangesToDatabase();
    }

    // Called by the button
    private submitWord(): void {
        // TODO
        // Assume everything is valid for now
        if (this.idOfWordBeingEdited != undefined) {            
            this.db.editWord(this.languageIndexFrom, this.languageIndexTo, this.idOfWordBeingEdited,
                this.inputWord.toLowerCase(), this.inputTranslations.toLowerCase().split(";"), 
                this.inputTags.toLowerCase().split(";"));
        } else {
            this.db.addWord(this.languageIndexFrom, this.languageIndexTo, 
                this.inputWord.toLowerCase(), this.inputTranslations.toLowerCase().split(";"), 
                this.inputTags.toLowerCase().split(";"));
        }

        this.inputWord = "";
        this.inputTranslations = "";
        this.inputTags = "";
        this.idOfWordBeingEdited = undefined; // Clear for future usage

        this.loadContent();

        this.dumpChangesToDatabase();
    }    

    private selectLanguage(source: string, language: Language): void {        
        this.resetDropdowns();
        
        switch (source) {
            case 'from':                
                if (this.languageNameFrom != language.name) { // not the current language
                    if (this.languageNameTo == language.name) {
                        this.swapLanguages();
                    } else {
                        this.languageIndexFrom = this.db.getLanguageIndexByName(language.name);
                        this.loadContent(); // reload
                    }  
                }
                break;
            case 'to':            
                if (this.languageNameTo != language.name) { // not the current language
                    if (this.languageNameFrom == language.name) {
                        this.swapLanguages();
                    } else {
                        this.languageIndexTo = this.db.getLanguageIndexByName(language.name);
                        this.loadContent(); // reload
                    }                    
                }
                break;
        }
    }

    private swapLanguages(): void {        
        const temp = this.languageIndexFrom;
        this.languageIndexFrom = this.languageIndexTo;
        this.languageIndexTo = temp;

        this.loadContent();
    }

    private toggleDropdown(event: any, source: string): void {        
        // To prevent the click from getting to the resetDropDowns().
        // Otherwise we couldn't open the dropdown
        event.stopPropagation();        

        switch (source) {
            case 'from':
                this.isOpenFrom = !this.isOpenFrom;                 
                this.isOpenTo = false;
                break;
            case 'to':            
                this.isOpenTo = !this.isOpenTo;                
                this.isOpenFrom = false;
                break;
        }
    }

    // When the user clicks anywhere on the screen
    private resetDropdowns(): void {        
        if (this.isOpenFrom) {
            this.isOpenFrom = false;
        }
        if (this.isOpenTo) {
            this.isOpenTo = false;
        }
    }
}

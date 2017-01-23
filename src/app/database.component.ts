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

    private loadContent():void {
        this.languageNameFrom = this.db.getLanguage(this.languageIndexFrom).name;
        this.languageNameTo = this.db.getLanguage(this.languageIndexTo).name;        
        
        const wordsTo = this.db.wordsOfLanguages[this.languageIndexTo].words;

        this.translations = this.db.connections[this.languageIndexFrom][this.languageIndexTo]            
            .map(connection => connection.to)
            .map(ids => ids
                .map(id => wordsTo.find(word => word.id == id))
            );        

        // Words appear only if they have non-empty translation in that language
        // WRONG!!! has to work with ids, not indices
        this.words = this.db.wordsOfLanguages[this.languageIndexFrom].words
            .filter((value, index) => (this.translations[index]) ? this.translations[index].length > 0 : false);

        this.translations = this.translations
            .filter(translation => (translation) ? translation.length > 0 : false);
    }



    private showDB(): void {        
        console.log("");
        console.log("<<>> WORDS GER <<>>");
        console.log(this.db.wordsOfLanguages[0].words.map(word => "" + word.id + " : " + word.w));

        console.log("");
        console.log("<<>> WORDS ENG <<>>");
        console.log(this.db.wordsOfLanguages[1].words.map(word => "" + word.id + " : " + word.w));

        console.log("");
        console.log("<<>> CONNECTIONS GER -> ENG <<>>");
        console.log(this.db.connections[0][1].map(conn => "" + conn.from + " -> " + conn.to.join(", ")));

        console.log("");
        console.log("<<>> CONNECTIONS ENG -> GER <<>>");
        console.log(this.db.connections[1][0].map(conn => "" + conn.from + " -> " + conn.to.join(", ")));
    }


    // Generates index
    private generateWord(): number {
        return 0;
    }



    // Called by the button
    private editWord(word: Word): void {
    
    }

    // Called by the button
    private removeWord(word: Word): void {
        console.log(">> Removed " + this.db.deleteWord(this.languageIndexFrom, this.languageIndexTo, 
            this.db.getWordIndexById(this.languageIndexFrom, word.id)).w);
    }

    // Called by the button
    private submitWord():void {
        // TODO
        // Assume everything is valid for now
        
        // this.db.addWord(this.idLanguageFrom, this.idLanguageTo, 
        //     this.inputWord, this.inputTranslations.split(";"), this.inputTags.split(";"));

        this.db.addWord(this.languageIndexFrom, this.languageIndexTo, 
            "newGerWord", ["tr1", "tr2"], ["tag1"]);
    }    

    private selectLanguage(source: string, language: Language):void {        
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

    private swapLanguages():void {        
        const temp = this.languageIndexFrom;
        this.languageIndexFrom = this.languageIndexTo;
        this.languageIndexTo = temp;

        this.loadContent();
    }

    private toggleDropdown(event:any, source: string):void {        
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
    private resetDropdowns():void {        
        if (this.isOpenFrom) {
            this.isOpenFrom = false;
        }
        if (this.isOpenTo) {
            this.isOpenTo = false;
        }
    }
}

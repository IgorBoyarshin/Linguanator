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

    private idLanguageFrom: number;
    private idLanguageTo: number;
    private languageFrom: string;
    private languageTo: string;
    private allLanguages: Language[];

    private words: Word[] = [];
    private translations: Word[][];
    // private connections: Word[];

    private isOpenFrom: boolean = false;
    private isOpenTo: boolean = false;    

    constructor(databaseService: DatabaseService) { 
        this.db = databaseService;
    }

    ngOnInit(): void {        
        this.db.init()
            .then(() => this.onDatabaseLoad());
    }

    private onDatabaseLoad(): void {
        // Starting languages
        this.idLanguageFrom = this.db.getLanguageIndexByLabel("ger"); // TODO: change
        this.idLanguageTo = this.db.getLanguageIndexByLabel("eng"); // TODO: change        
        
        this.allLanguages = this.db.settings.languages.registeredLanguages;

        this.loadContent();
    }

    private loadContent():void {
        this.languageFrom = this.db.getLanguage(this.idLanguageFrom).name;
        this.languageTo = this.db.getLanguage(this.idLanguageTo).name;        
        
        const wordsTo = this.db.wordsOfLanguages[this.idLanguageTo].words;
        this.translations = this.db.connections[this.idLanguageFrom][this.idLanguageTo]            
            .map(connection => connection.to)
            .map(ids => ids
                .map(id => wordsTo.find(word => word.id == id))
            );        

        // Words appear only if they have non-empty translation in that language
        this.words = this.db.wordsOfLanguages[this.idLanguageFrom].words
            .filter((value, index) => (this.translations[index]) ? this.translations[index].length > 0 : false);
    }

    private editWord(word: Word): void {
        
    }

    private removeWord(word: Word): void {
                
    }

    private toggleDropdown(event:any, source: string):void {        
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

    private selectLanguage(source: string, language: Language):void {        
        this.resetDropDowns();
        
        switch (source) {
            case 'from':                
                if (this.languageFrom != language.name) { // not the current language
                    if (this.languageTo == language.name) {
                        this.swapLanguages();
                    } else {
                        this.idLanguageFrom = this.db.getLanguageIndexByName(language.name);
                        this.loadContent(); // reload
                    }  
                }
                break;
            case 'to':            
                if (this.languageTo != language.name) { // not the current language
                    if (this.languageFrom == language.name) {
                        this.swapLanguages();
                    } else {
                        this.idLanguageTo = this.db.getLanguageIndexByName(language.name);
                        this.loadContent(); // reload
                    }                    
                }
                break;
        }
    }

    private swapLanguages():void {        
        const temp = this.idLanguageFrom;
        this.idLanguageFrom = this.idLanguageTo;
        this.idLanguageTo = temp;

        this.loadContent();
    }

    private resetDropDowns():void {        
        if (this.isOpenFrom) {
            this.isOpenFrom = false;
        }
        if (this.isOpenTo) {
            this.isOpenTo = false;
        }
    }
}

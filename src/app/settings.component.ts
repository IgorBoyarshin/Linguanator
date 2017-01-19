import { Component, OnInit } from '@angular/core';

import { DatabaseService } from './database.service';
import { Language } from './language';

@Component({
    selector: 'settings',
    templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
    constructor(private databaseService: DatabaseService) {}

    private registeredLanguages: Language[];
    private allTags: string[];

    ngOnInit(): void {
        this.databaseService.init()
            .then(() => this.onDatabaseLoad());
    }

    private onDatabaseLoad(): void {
        this.registeredLanguages = this.databaseService.settings.languages.registeredLanguages;

        this.allTags = this.databaseService.wordsOfLanguages
            .map((wordsOfLanguage) => wordsOfLanguage.words) // get words[] for every language
            .reduce((arrays, array) => arrays.concat(array), []) // concat all words[]
            .map(word => word.t) // retrieve tags from words
            .reduce((allTags, tags) => allTags.concat(tags), []) // concat all tags[]
            .reduce((accTags, tag) => { // keep unique
                if (!accTags.includes(tag)) {
                    accTags.push(tag);
                }

                return accTags;
            }, []);
    }
}

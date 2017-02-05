import { Component, OnInit } from '@angular/core';

import { DatabaseService } from './database.service';
import { Language } from './language';

@Component({
    selector: 'settings',
    templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
    constructor(databaseService: DatabaseService) {
        this.db = databaseService;        
    }

    private db: DatabaseService;

    private registeredLanguages: Language[];
    // private allTags: string[] = [];

    ngOnInit(): void {        
        this.db.init()
            .then(() => this.onDatabaseLoad());
    }

    private onDatabaseLoad(): void {        
        this.registeredLanguages = this.db.settings.languages.registeredLanguages;

        if (this.db.tagsToUse.length == 0) {            
            this.db.useAllTags();
        }
    }

    private addTag(tagName: string): void {        
        this.db.registeredTags.push(tagName);
        this.db.tagsToUse.push(tagName);
    }

    private renameTag(oldTagName: string, newTagName: string): void {
        this.db.renameAllTagOccurences(oldTagName, newTagName);        
    }

    private checkTag(tag: string): void {
        const tagIndex: number = this.db.tagsToUse.findIndex(t => t == tag);
        if (tagIndex == undefined || tagIndex == -1) {
            this.db.tagsToUse.push(tag);
        } else {
            this.db.tagsToUse.splice(tagIndex, 1);
        }        
    }

    private checkAllTags(): void {
        if (this.db.tagsToUse.length == this.db.registeredTags.length) { // all tags are checked
            this.db.tagsToUse = [];
        } else {
            this.db.useAllTags();
        }
    }
}

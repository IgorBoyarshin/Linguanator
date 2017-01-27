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
    private allTags: string[] = [];

    ngOnInit(): void {        
        this.db.init()
            .then(() => this.onDatabaseLoad());
    }

    private onDatabaseLoad(): void {        
        this.registeredLanguages = this.db.settings.languages.registeredLanguages;

        // this.allTags = this.db.getRegisteredTags();
    }
}

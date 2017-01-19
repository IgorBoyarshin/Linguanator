import { Component } from '@angular/core';
import { DatabaseService } from './database.service';
import { OnInit } from '@angular/core';

import { Word } from './word';

@Component({
    selector: 'database',
    templateUrl: './database.component.html'
})
export class DatabaseComponent implements OnInit {
    words: Word[];

    constructor(private databaseService: DatabaseService) { }

    ngOnInit(): void {
        this.databaseService.init()
            .then(() => this.onDatabaseLoad());
    }

    private onDatabaseLoad(): void {
        this.words = this.databaseService.wordsOfLanguages[1].words;
    }
}

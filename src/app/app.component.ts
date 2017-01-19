import { Component } from '@angular/core';

import { DatabaseService } from './database.service';
import { OnInit } from '@angular/core';

@Component({
    selector: 'linguanator-app',
    templateUrl: './app.component.html',
    providers: [DatabaseService]
})
export class AppComponent implements OnInit {

    words: string[];

    ngOnInit(): void {
        // this.databaseService.getWords().then(words => this.words = words);
    }

    constructor(private databaseService : DatabaseService) {

    }
}

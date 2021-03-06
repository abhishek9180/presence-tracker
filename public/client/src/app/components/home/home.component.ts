import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Socket } from 'ngx-socket-io';
import { interval } from 'rxjs';

import { UserBean } from 'src/app/beans/user.bean';
import { ApiService } from '../../api.service';
import { HomeService } from './home.service';
import { DialogComponent } from '../../shared/dialog/dialog.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {

  userDetails: UserBean;
  messageList: any;
  activeUsers: any = [];
  activeUsersUI: any = [];
  subscriptionList: any = [];

  constructor(
    private router: Router,
    private socket: Socket,
    private apiService: ApiService,
    private homeService: HomeService,
    public dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.userDetails = this.getUserDetails();
    this.socket.connect();
    this.onSocketConnection();
    this.onSocketResponse();
    this.onLogout();
  }

  openDialog(docUsers): void {
    const dialogRef = this.dialog.open(DialogComponent, {
      width: '320px',
      height: '400px',
      data: docUsers
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
    });
  }

  showDocumentHistory() {
    this.apiService.getData('doc/1/users').subscribe(docUsers => {
      this.openDialog(docUsers);
    },
      error => {
        console.log(error);
      })
  }

  addActiveUsers(activeUsers: any) {
    if (activeUsers && activeUsers.length) {
      activeUsers.forEach(docUser => {
        if (docUser.user) {
          this.activeUsers.push(docUser);
        }
      });
    }
  }

  addNewUser(activeUser: any) {
    const index = this.activeUsers.findIndex(docUser => {
      if (docUser.user && activeUser.user && docUser.user._id === activeUser.user._id) {
        return true;
      }
    });
    if (index < 0) {
      this.activeUsers.push(activeUser);
    } else {
      // update socket Id
      this.activeUsers[index].socketId = activeUser.socketId;
    }
  }

  removeDisconnectedUser(socketId: string) {
    let userIndex = -1;
    let socketIndex = -1;
    this.activeUsers.forEach((docUser, i) => {
      const sIndex = docUser.socketId.findIndex(id => id === socketId);
      if (sIndex > -1) {
        socketIndex = sIndex;
        userIndex = i;
        return;
      }
    });
    if (userIndex > -1 && socketIndex > -1) {
      if (this.activeUsers[userIndex].socketId.length === 1) {
        // remove user since user is offline
        this.activeUsers.splice(userIndex, 1);
      } else {
        // remove socket id
        this.activeUsers[userIndex].socketId.splice(socketIndex, 1);
      }
    }
  }

  createActiveUserUI() {
    const maxIndex = this.activeUsers.length > 5 ? 5 : this.activeUsers.length;
    this.activeUsersUI = [];
    // insert only 5 users
    for (let i = 0; i < maxIndex; i++) {
      this.activeUsersUI.push(this.activeUsers[i]);
    }
  }

  onSocketResponse() {
    // listen to socket message
    const socketResponse = this.homeService
      .getActiveUsers()
      .subscribe((message: any) => {
        if (message.error !== true && message.userConnected === true) {
          this.addActiveUsers(message.activeUsers);
        } else if (message.error !== true && message.newUserConnected === true) {
          this.addNewUser(message.activeUser);
        } else if (message.error !== true && message.userDisconnected === true) {
          this.removeDisconnectedUser(message.socketId);
        }
        if (message.error !== true) {
          this.createActiveUserUI();
        }
      });

    this.subscriptionList.push(socketResponse);
  }

  onSocketConnection() {
    // emit user details after successful connection
    this.homeService.emitSocketEvent('get-active-users', { userId: this.userDetails._id });
  }

  onLogout() {
    // emit user details after successful connection
    const logoutSubscription = this.homeService
      .onSocketDisconnect()
      .subscribe((message: any) => {
        // if socket disconnected logout user
        if (!message.error) {
          this.apiService.getHead('logout').subscribe(res => {
            // logged out successfully
            localStorage.clear();
            this.router.navigate(['./login']);
          },
            error => {
              console.error(error);
            });
        }
      });
    this.subscriptionList.push(logoutSubscription);
  }


  logoutUser() {
    this.homeService.emitSocketEvent('logout', { userId: this.userDetails._id });
  }

  getUserDetails() {
    try {
      const userDetails = JSON.parse(localStorage.getItem('userDetails'));
      return userDetails;
    } catch (err) {
      console.error(err);
      localStorage.clear();
      // navigate to login
      this.router.navigate(['./login']);
    }
  }

  ngOnDestroy() {
    this.subscriptionList.forEach(subscription => subscription.unsubscribe());
  }

}

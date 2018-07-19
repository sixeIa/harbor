import { SessionService } from "./../shared/session.service";
import { TranslateService } from "@ngx-translate/core";
import { Observable } from "rxjs/Observable";
import { Subscription } from "rxjs/Subscription";
import { Component, OnInit, ViewChild, OnDestroy } from "@angular/core";
import {operateChanges, OperateInfo, OperationService, OperationState} from "harbor-ui";

import {
  ConfirmationTargets,
  ConfirmationState,
  ConfirmationButtons
} from "../shared/shared.const";
import { ConfirmationMessage } from "../shared/confirmation-dialog/confirmation-message";
import { ConfirmationDialogService } from "./../shared/confirmation-dialog/confirmation-dialog.service";
import { AddGroupModalComponent } from "./add-group-modal/add-group-modal.component";
import { UserGroup } from "./group";
import { GroupService } from "./group.service";
import { MessageHandlerService } from "../shared/message-handler/message-handler.service";

@Component({
  selector: "app-group",
  templateUrl: "./group.component.html",
  styleUrls: ["./group.component.scss"]
})
export class GroupComponent implements OnInit, OnDestroy {
  searchTerm = "";
  loading = true;
  groups: UserGroup[] = [];
  currentPage = 1;
  totalCount = 0;
  selectedGroups: UserGroup[] = [];
  currentTerm = "";
  delSub: Subscription;
  batchOps = 'idle';
  batchInfos = new Map();

  @ViewChild(AddGroupModalComponent) newGroupModal: AddGroupModalComponent;

  constructor(
    private operationService: OperationService,
    private translate: TranslateService,
    private operateDialogService: ConfirmationDialogService,
    private groupService: GroupService,
    private msgHandler: MessageHandlerService,
    private session: SessionService
  ) {}

  ngOnInit() {
    this.loadData();
    this.delSub = this.operateDialogService.confirmationConfirm$.subscribe(
      message => {
        if (
          message &&
          message.state === ConfirmationState.CONFIRMED &&
          message.source === ConfirmationTargets.PROJECT_MEMBER
        ) {
          if (this.batchOps === 'delete') {
            this.deleteGroups();
          }
        }
      }
    );
  }
  ngOnDestroy(): void {
    this.delSub.unsubscribe();
  }

  refresh(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.groupService.getUserGroups().subscribe(groups => {
      this.groups = groups.filter(group => {
        if (!group.group_name) {group.group_name = ''; }
        return group.group_name.includes(this.searchTerm);
        }
      );
      this.loading = false;
    });
  }

  addGroup(): void {
    this.newGroupModal.open();
  }

  editGroup(): void {
    this.newGroupModal.open(this.selectedGroups[0], true);
  }

  openDeleteConfirmationDialog(): void {
    // open delete modal
    this.batchOps = 'delete';
    let nameArr: string[] = [];
    if (this.selectedGroups.length > 0) {
      this.selectedGroups.forEach(group => {
        nameArr.push(group.group_name);
      });
      // batchInfo.id = group.id;
      let deletionMessage = new ConfirmationMessage(
        "MEMBER.DELETION_TITLE",
        "MEMBER.DELETION_SUMMARY",
        nameArr.join(","),
        this.selectedGroups,
        ConfirmationTargets.PROJECT_MEMBER,
        ConfirmationButtons.DELETE_CANCEL
      );
      this.operateDialogService.openComfirmDialog(deletionMessage);
    }
  }

  deleteGroups() {
    let obs = this.selectedGroups.map(group => {
      let operMessage = new OperateInfo();
      operMessage.name = 'OPERATION.DELETE_GROUP';
      operMessage.data.id = group.id;
      operMessage.state = OperationState.progressing;
      operMessage.data.name = group.group_name;

      this.operationService.publishInfo(operMessage);
      return this.groupService
        .deleteGroup(group.id)
        .flatMap(response => {
          return this.translate.get("BATCH.DELETED_SUCCESS").flatMap(res => {
            operateChanges(operMessage, OperationState.success);
            return Observable.of(res);
          });
        })
        .catch(err => {
          return this.translate.get("BATCH.DELETED_FAILURE").flatMap(res => {
            operateChanges(operMessage, OperationState.failure, res);
            return Observable.of(res);
          });
        });
    });

    Observable.forkJoin(obs).subscribe(
      res => {
        this.selectedGroups = [];
        this.batchOps = 'idle';
        this.loadData();
      },
      err => this.msgHandler.handleError(err)
    );
  }

  groupToSring(type: number) {
    if (type === 1) {return 'GROUP.LDAP_TYPE'; } else {return 'UNKNOWN'; }
  }

  doFilter(groupName: string): void {
    this.searchTerm = groupName;
    this.loadData();
  }
  get canAddGroup(): boolean {
    return this.session.currentUser.has_admin_role;
  }

  get canEditGroup(): boolean {
    return (
      this.selectedGroups.length === 1 &&
      this.session.currentUser.has_admin_role
    );
  }
}

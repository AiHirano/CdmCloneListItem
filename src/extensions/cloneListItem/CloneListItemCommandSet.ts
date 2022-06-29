import { Log } from '@microsoft/sp-core-library';
import {
  BaseListViewCommandSet,
  Command,
  IListViewCommandSetListViewUpdatedParameters,
  IListViewCommandSetExecuteEventParameters,
  ListViewStateChangedEventArgs
} from '@microsoft/sp-listview-extensibility';
import { Dialog } from '@microsoft/sp-dialog';

import * as strings from 'CloneListItemCommandSetStrings';
//ヘルパークラス
import{SPHttpClient,SPHttpClientResponse} from '@microsoft/sp-http';

/**
 * If your command set uses the ClientSideComponentProperties JSON input,
 * it will be deserialized into the BaseExtension.properties object.
 * You can define an interface to describe it.
 */
export interface ICloneListItemCommandSetProperties {
  // This is an example; replace with your own properties
  sampleTextOne: string;
  sampleTextTwo: string;
}

//SharePoint リストアイテム
interface IListItem{
  Id:number;
  Title:string;
  Photo:string;
  Description:string;  
}


const LOG_SOURCE: string = 'CloneListItemCommandSet';


export default class CloneListItemCommandSet extends BaseListViewCommandSet<ICloneListItemCommandSetProperties> {
  //エンティティ型名
  private listItemEntityTypeName:string=undefined;

  public onInit(): Promise<void> {
    Log.info(LOG_SOURCE, 'Initialized CloneListItemCommandSet');

    // initial state of the command's visibility
    const item_copy: Command = this.tryGetCommand('ITEM_COPY');    
    const one_item_selected: Command = this.tryGetCommand('ONE_ITEM_SELECTED');    
    const two_item_selected: Command = this.tryGetCommand('TWO_ITEM_SELECTED');
    const always_on: Command = this.tryGetCommand('ALWAYS_ON');

    item_copy.visible = false;
    one_item_selected.visible=false;
    two_item_selected.visible=false;
    always_on.visible=true;
 
    this.context.listView.listViewStateChangedEvent.add(this, this._onListViewStateChanged);

    return Promise.resolve();
  }
  private _onListViewStateChanged = (args: ListViewStateChangedEventArgs): void => {
    Log.info(LOG_SOURCE, 'List view state changed');

    //コマンドの取得
    const item_copy: Command = this.tryGetCommand('ITEM_COPY');    
    const one_item_selected: Command = this.tryGetCommand('ONE_ITEM_SELECTED');    
    const two_item_selected: Command = this.tryGetCommand('TWO_ITEM_SELECTED');
    const always_on: Command = this.tryGetCommand('ALWAYS_ON');

    /***リストの判定***/
    //特定のリストでのみ動作させる
    let TARGET_LISTS: string[] = ["Custom Command", "Sheep"];
    
    //現在のリストの取得
    let ListTitle = this.context.pageContext.list.title;
  
    //Custom Listの時
    if (ListTitle == TARGET_LISTS[0]) {
          
      item_copy.visible=false;//コピーコマンドは非表示
      always_on.visible=true;//表示
      //アイテムを1つ選択しているときに表示する      
      one_item_selected.visible = this.context.listView.selectedRows.length === 1;
      //アイテムを2つ選択しているときに表示する
      two_item_selected.visible = this.context.listView.selectedRows.length === 2;
     
    }
    //Sheepの時
    if(ListTitle == TARGET_LISTS[1]){
      //コピーコマンドの以外をすべて非表示   
      one_item_selected.visible=false;
      two_item_selected.visible=false;
      always_on.visible=false;
      //コピーコマンドのみ表示
      item_copy.visible =   this.context.listView.selectedRows.length === 1;
       }

       this.raiseOnChange();
       
    // TODO: Add your logic here
    // You can call this.raiseOnChage() to update the command bar
  }

  public onExecute(event: IListViewCommandSetExecuteEventParameters): void {
    switch (event.itemId) {
      case 'ONE_ITEM_SELECTED':
        Dialog.alert(`ONE_ITEM_SELECTED コマンドがクリックされました; Title = ${event.selectedRows[0].getValueByName('Title')}`);
        break;
      case 'TWO_ITEM_SELECTED':
        Dialog.alert(`TWO_ITEM_SELECTED コマンドがクリックされました; Title = ${event.selectedRows[event.selectedRows.length - 1].getValueByName('Title')}`);
        break;
      case 'ALWAYS_ON':
        Dialog.alert(`ALWAYS_ON コマンドがクリックされました. 選択された総数: ${event.selectedRows.length}`);
        break;
      case 'ITEM_COPY':
        this.getListItem(event.selectedRows[0].getValueByName('ID')).then((response)=>{   
          this.cloneItem(response);               
            Dialog.alert(`アイテムをコピーしました`);
        });      
        break;
      default:
        throw new Error('不明なコマンド');
    }
  }

  //選択したリストアイテムを取得する
  private getListItem(ItemId:string):Promise<IListItem>{
    return this.context.spHttpClient.get(
 `${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.context.pageContext.list.title}')/items(${ItemId})?$select=Title,Id,Photo,Description`,
       SPHttpClient.configurations.v1,
       {
         headers: {
           'Accept': 'application/json;odata=nometadata',
           'odata-version': ''
         }
       })
       .then((response: SPHttpClientResponse) => {
         return response.json();
       });
   }

   //アイテムの新規作成
  private cloneItem(SourceItem:IListItem): void {
    Dialog.alert('アイテム作成');
    this.getListItemEntityTypeName()
      .then((listItemEntityTypeName: string): Promise<SPHttpClientResponse> => {
        const body: string = JSON.stringify({
          '__metadata': {
            'type': listItemEntityTypeName
          },
          'Title': `[Clone] - ${SourceItem.Title}`,
          'Photo':`${SourceItem.Photo}`,
          'Description':`${SourceItem.Description}`
        });
        return this.context.spHttpClient.post(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.context.pageContext.list.title}')/items`,
          SPHttpClient.configurations.v1,
          {
            headers: {
              'Accept': 'application/json;odata=nometadata',
              'Content-type': 'application/json;odata=verbose',
              'odata-version': ''
            },
            body: body
          });
      })
      .then((response: SPHttpClientResponse): Promise<IListItem> => {    
        return response.json();
      })
      ;
  }

 //リストのエンティティ名の取得
private getListItemEntityTypeName(): Promise<string> {  
  return new Promise<string>((resolve: (listItemEntityTypeName: string) => void, reject: (error: any) => void): void => {
    if (this.listItemEntityTypeName) {
      resolve(this.listItemEntityTypeName);
      return;
    }
    this.context.spHttpClient.get(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.context.pageContext.list.title}')?$select=ListItemEntityTypeFullName`,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'odata-version': ''
        }
      })
      .then((response: SPHttpClientResponse): Promise<{ ListItemEntityTypeFullName: string }> => {
        return response.json();
      }, (error: any): void => {
        reject(error);
      })
      .then((response: { ListItemEntityTypeFullName: string }): void => {
        this.listItemEntityTypeName = response.ListItemEntityTypeFullName;
        resolve(this.listItemEntityTypeName);
      });
  });
}

}

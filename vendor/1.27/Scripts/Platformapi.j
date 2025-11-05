//该文件定义了平台接入的地图api列表

//活动完成调用
native DzAPI_Map_MissionComplete        takes player whichPlayer, string key, string value returns nothing

//获取当前活动数据
native DzAPI_Map_GetActivityData        takes nothing returns string

//获取当前地图等级
native DzAPI_Map_GetMapLevel            takes player whichPlayer returns integer

//保存key，value到服务器
native DzAPI_Map_SaveServerValue        takes player whichPlayer, string key, string value returns boolean

//读取服务器对应key的value
native DzAPI_Map_GetServerValue         takes player whichPlayer, string key returns string

//地图统计-提交统计数据
native DzAPI_Map_Stat_SetStat           takes player whichPlayer, string key, string value returns nothing

//rpg天梯-提交统计数据
native DzAPI_Map_Ladder_SetStat         takes player whichPlayer, string key, string value returns nothing

//rpg天梯-提交指定玩家的统计数据
native DzAPI_Map_Ladder_SetPlayerStat   takes player whichPlayer, string key, string value returns nothing

//判断当前地图是否rpg大厅来的
native DzAPI_Map_IsRPGLobby             takes nothing returns boolean

//取游戏开始时间
native DzAPI_Map_GetGameStartTime       takes nothing returns integer

//判断当前地图是否rpg天梯
native DzAPI_Map_IsRPGLadder            takes nothing returns boolean

//获取匹配类型
native DzAPI_Map_GetMatchType      		takes nothing returns integer

//设置玩家的英雄
native DzAPI_Map_UpdatePlayerHero		takes player whichPlayer, unit whichUnit returns nothing

//获取当前天梯等级
native DzAPI_Map_GetLadderLevel         takes player whichPlayer returns integer

//提供给地图的接口，用与判断是否红V
native DzAPI_Map_IsRedVIP               takes player whichPlayer returns boolean

//提供给地图的接口，用与判断是否蓝V
native DzAPI_Map_IsBlueVIP              takes player whichPlayer returns boolean

//提供给地图的接口，用与取天梯排名
native DzAPI_Map_GetLadderRank          takes player whichPlayer returns integer

//提供给地图的接口，用与取地图等级排名
native DzAPI_Map_GetMapLevelRank        takes player whichPlayer returns integer

//获取加载服务器存档时的错误码
native DzAPI_Map_GetServerValueErrorCode takes player whichPlayer returns integer

//获取公会名称
native DzAPI_Map_GetGuildName           takes player whichPlayer returns string

//获取公会职责 Member=10 Admin=20 Leader=30
native DzAPI_Map_GetGuildRole           takes player whichPlayer returns integer

//获取地图配置
native DzAPI_Map_GetMapConfig           takes string key returns string

//判断是否拥有商品
native DzAPI_Map_HasMallItem            takes player whichPlayer, string key returns boolean

//修改游戏内商店物品数量
native DzAPI_Map_ChangeStoreItemCount   takes integer team, string itemId, integer count returns nothing

//修改游戏内商店物品CD
native DzAPI_Map_ChangeStoreItemCoolDown takes integer team, string itemId, integer seconds returns nothing

//开启/关闭内置商店
native DzAPI_Map_ToggleStore            takes player whichPlayer, boolean show returns nothing

//读取服务器装备数据
native DzAPI_Map_GetServerArchiveEquip  takes player whichPlayer, string key returns integer

//读取服务器掉落数据
native DzAPI_Map_GetServerArchiveDrop   takes player whichPlayer, string key returns string

//触发boss击杀
native DzAPI_Map_OrpgTrigger            takes player whichPlayer, string key returns nothing

//获取玩家ID
native DzAPI_Map_GetUserID              takes player whichPlayer returns integer

//获取平台vip
native DzAPI_Map_GetPlatformVIP         takes player whichPlayer returns integer

//保存key，value到公共存档中
native DzAPI_Map_SavePublicArchive      takes player whichPlayer, string key, string value returns boolean

//读取公共存档对应key的value
native DzAPI_Map_GetPublicArchive       takes player whichPlayer, string key returns string

//局数消耗商品调用
native DzAPI_Map_UseConsumablesItem     takes player whichPlayer, string key returns nothing

//提交DA数据统计
native DzAPI_Map_Statistics             takes player whichPlayer, string category, string label returns nothing

// 提交结算数据
native DzAPI_Map_GameResult_CommitData  takes player whichPlayer, string key, string value returns nothing

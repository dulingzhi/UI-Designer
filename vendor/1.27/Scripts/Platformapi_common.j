//统一获取数据的接口

//获取integer数据
native function RequestExtraIntegerData takes integer dataType, player whichPlayer, string param1, string param2, boolean param3, integer param4, integer param5, integer param6 returns integer

//获取boolean数据
native function RequestExtraBooleanData takes integer dataType, player whichPlayer, string param1, string param2, boolean param3, integer param4, integer param5, integer param6 returns boolean

//获取string数据
native function RequestExtraStringData takes integer dataType, player whichPlayer, string param1, string param2, boolean param3, integer param4, integer param5, integer param6 returns string

//获取real数据
native function RequestExtraRealData takes integer dataType, player whichPlayer, string param1, string param2, boolean param3, integer param4, integer param5, integer param6 returns real

////////////////////////////////////////////////////////////////////////////////////////
// Data Type
// 取值范围从1开始
////////////////////////////////////////////////////////////////////////////////////////
// MissionComplete,               //用作完成某个任务，发奖励
function DzAPI_Map_MissionComplete takes player whichPlayer, string key, string value returns nothing
    call RequestExtraIntegerData(1, whichPlayer, key, value, false, 0, 0, 0)
endfunction

// GetActivityData,               //提供给地图的接口，用作取服务器上的活动数据
function DzAPI_Map_GetActivityData takes nothing returns string
    return RequestExtraStringData(2, null, null, null, false, 0, 0, 0)
endfunction

// GetMapLevel,                   //提供给地图的接口，用与取地图等级
function DzAPI_Map_GetMapLevel takes player whichPlayer returns integer
    return RequestExtraIntegerData(3, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// SaveServerValue,               //保存服务器存档
function DzAPI_Map_SaveServerValue takes player whichPlayer, string key, string value returns boolean
    return RequestExtraBooleanData(4, whichPlayer, key, value, false, 0, 0, 0)
endfunction

// GetServerValue,                //读取服务器存档
function DzAPI_Map_GetServerValue takes player whichPlayer, string key returns string
    return RequestExtraStringData(5, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// GetServerValueErrorCode,       //读取加载服务器存档时的错误码
function DzAPI_Map_GetServerValueErrorCode takes player whichPlayer returns integer
    return RequestExtraIntegerData(6, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// SetStat,                       //统计-提交地图数据
function DzAPI_Map_Stat_SetStat takes player whichPlayer, string key, string value returns nothing
    call RequestExtraIntegerData(7, whichPlayer, key, value, false, 0, 0, 0)
endfunction

// SetLadderStat,                 //天梯-统计数据
function DzAPI_Map_Ladder_SetStat takes player whichPlayer, string key, string value returns nothing
    call RequestExtraIntegerData(8, whichPlayer, key, value, false, 0, 0, 0)
endfunction

// SetLadderPlayerStat,           //天梯-统计数据
function DzAPI_Map_Ladder_SetPlayerStat takes player whichPlayer, string key, string value returns nothing
    call RequestExtraIntegerData(9, whichPlayer, key, value, false, 0, 0, 0)
endfunction

// IsRPGLobby,                    //检查是否大厅地图
function DzAPI_Map_IsRPGLobby takes nothing returns boolean
    return RequestExtraBooleanData(10, null, null, null, false, 0, 0, 0)
endfunction

// GetGameStartTime,              //取游戏开始时间
function DzAPI_Map_GetGameStartTime takes nothing returns integer
    return RequestExtraIntegerData(11, null, null, null, false, 0, 0, 0)
endfunction

// IsRPGLadder,                   //判断当前是否rpg天梯
function DzAPI_Map_IsRPGLadder takes nothing returns boolean
    return RequestExtraBooleanData(12, null, null, null, false, 0, 0, 0)
endfunction

// GetMatchType,                  //获取匹配类型
function DzAPI_Map_GetMatchType takes nothing returns integer
    return RequestExtraIntegerData(13, null, null, null, false, 0, 0, 0)
endfunction

// GetLadderLevel,                //提供给地图的接口，用与取天梯等级
function DzAPI_Map_GetLadderLevel takes player whichPlayer returns integer
    return RequestExtraIntegerData(14, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// IsRedVIP,                      //提供给地图的接口，用与判断是否红V
function DzAPI_Map_IsRedVIP takes player whichPlayer returns boolean
    return RequestExtraBooleanData(15, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// IsBlueVIP,                     //提供给地图的接口，用与判断是否蓝V
function DzAPI_Map_IsBlueVIP takes player whichPlayer returns boolean
    return RequestExtraBooleanData(16, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GetLadderRank,                 //提供给地图的接口，用与取天梯排名
function DzAPI_Map_GetLadderRank takes player whichPlayer returns integer
    return RequestExtraIntegerData(17, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GetMapLevelRank,               //提供给地图的接口，用与取地图等级排名
function DzAPI_Map_GetMapLevelRank takes player whichPlayer returns integer
    return RequestExtraIntegerData(18, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GetGuildName,                  //获取公会名称
function DzAPI_Map_GetGuildName takes player whichPlayer returns string
    return RequestExtraStringData(19, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GetGuildRole,                  //获取公会职责 Member=10 Admin=20 Leader=30
function DzAPI_Map_GetGuildRole takes player whichPlayer returns integer
    return RequestExtraIntegerData(20, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GetMapConfig,                  //获取地图配置
function DzAPI_Map_GetMapConfig takes string key returns string
    return RequestExtraStringData(21, null, key, null, false, 0, 0, 0)
endfunction

// HasMallItem,                   //判断是否拥有商品
function DzAPI_Map_HasMallItem takes player whichPlayer, string key returns boolean
    return RequestExtraBooleanData(22, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// ChangeInGameStoreItemCount,    //修改游戏内商店物品数量
function DzAPI_Map_ChangeStoreItemCount takes integer team, string itemId, integer count returns nothing
    call RequestExtraIntegerData(23, null, itemId, null, false, team, count, 0)
endfunction

// ChangeInGameStoreItemCoolDown, //修改游戏内商店物品CD
function DzAPI_Map_ChangeStoreItemCoolDown takes integer team, string itemId, integer seconds returns nothing
    call RequestExtraIntegerData(24, null, itemId, null, false, team, seconds, 0)
endfunction

// ToggleInGameStore,             //开启/关闭内置商店
function DzAPI_Map_ToggleStore takes player whichPlayer, boolean show returns nothing
    call RequestExtraIntegerData(25, whichPlayer, null, null, show, 0, 0, 0)
endfunction

// GetServerArchiveEquip,         //读取服务器装备数据
function DzAPI_Map_GetServerArchiveEquip takes player whichPlayer, string key returns integer
    return RequestExtraIntegerData(26, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// GetServerArchiveDrop,          //读取服务器掉落数据
function DzAPI_Map_GetServerArchiveDrop takes player whichPlayer, string key returns string
    return RequestExtraStringData(27, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// OrpgTrigger,                   //触发boss击杀
function DzAPI_Map_OrpgTrigger takes player whichPlayer, string key returns nothing
    call RequestExtraIntegerData(28, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// GetUserID,                     //获取玩家ID
function DzAPI_Map_GetUserID takes player whichPlayer returns integer
    return RequestExtraIntegerData(29, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GetPlatformVIP,                //获取平台vip
function DzAPI_Map_GetPlatformVIP takes player whichPlayer returns integer
    return RequestExtraIntegerData(30, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// SavePublicArchive,             //保存服务器存档组
function DzAPI_Map_SavePublicArchive takes player whichPlayer, string key, string value returns boolean
    return RequestExtraBooleanData(31, whichPlayer, key, value, false, 0, 0, 0)
endfunction

// GetPublicArchive,              //读取服务器存档组
function DzAPI_Map_GetPublicArchive takes player whichPlayer, string key returns string
    return RequestExtraStringData(32, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// UseConsumablesItem,            //使用消耗类商品
function DzAPI_Map_UseConsumablesItem takes player whichPlayer, string key returns nothing
    call RequestExtraIntegerData(33, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// Statistics,                    //平台统计
function DzAPI_Map_Statistics takes player whichPlayer, string eventKey, string eventType, integer value returns nothing
    call RequestExtraBooleanData(34, whichPlayer, eventKey, eventType, false, value, 0, 0)
endfunction

// SystemArchive,                 //系统存档
function DzAPI_Map_SystemArchive takes player whichPlayer, string key returns string
    return RequestExtraStringData(35, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// GlobalArchive,                 //读取公共存档
function DzAPI_Map_GlobalArchive takes string key returns nothing
    return RequestExtraStringData(36, null, key, null, false, 0, 0, 0)
endfunction

// SaveGlobalArchive,             //保存公共存档
function DzAPI_Map_SaveGlobalArchive takes player whichPlayer, string key, string value returns boolean
    return RequestExtraBooleanData(37, whichPlayer, key, value, false, 0, 0, 0)
endfunction

// ServerArchive,                 //读取服务器存档（区分大小写）
function DzAPI_Map_ServerArchive takes player whichPlayer, string key returns nothing
    return RequestExtraStringData(38, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// SaveServerArchive,             //保存服务器存档（区分大小写）
function DzAPI_Map_SaveServerArchive takes player whichPlayer, string key, string value returns nothing
    return RequestExtraBooleanData(39, whichPlayer, key, value, false, 0, 0, 0)
endfunction

// IsRPGQuickMatch,               //RPG快速匹配
function DzAPI_Map_IsRPGQuickMatch takes nothing returns boolean
    return RequestExtraBooleanData(40, null, null, null, false, 0, 0, 0)
endfunction

// GetMallItemCount,              //获取商城道具数量
function DzAPI_Map_GetMallItemCount takes player whichPlayer, string key returns integer
    return RequestExtraIntegerData(41, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// ConsumeMallItem,               //使用商城道具
function DzAPI_Map_ConsumeMallItem takes player whichPlayer, string key, integer count returns boolean
    return RequestExtraBooleanData(42, whichPlayer, key, null, false, count, 0, 0)
endfunction

// EnablePlatformSettings,        //启用平台功能 option = 1 锁定镜头距离，option = 2 显示血、蓝条，option = 3 智能施法，option = 4 改键，option = 5 alt键控制血条, option = 6 禁用血条随镜头缩放（默认禁用）
function DzAPI_Map_EnablePlatformSettings takes player whichPlayer, integer option, boolean enable returns boolean
    return RequestExtraBooleanData(43, whichPlayer, null, null, enable, option, 0, 0)
endfunction

// IsBuyReforged,                 //是否购买了重制版
function DzAPI_Map_IsBuyReforged takes player whichPlayer returns boolean
    return RequestExtraBooleanData(44, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// PlayedGames,                   //游戏局数
function DzAPI_Map_PlayedGames takes player whichPlayer returns integer
    return RequestExtraIntegerData(45, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// CommentCount,                  //玩家的评论次数
function DzAPI_Map_CommentCount takes player whichPlayer returns integer
    return RequestExtraIntegerData(46, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// FriendCount,                   //玩家的好友数量
function DzAPI_Map_FriendCount takes player whichPlayer returns integer
    return RequestExtraIntegerData(47, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// IsConnoisseur,                 //是否鉴赏家
function DzAPI_Map_IsConnoisseur takes player whichPlayer returns boolean
    return RequestExtraBooleanData(48, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// IsBattleNetAccount,            //是否战网账号
function DzAPI_Map_IsBattleNetAccount takes player whichPlayer returns boolean
    return RequestExtraBooleanData(49, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// IsAuthor,                      //是否本图作者
function DzAPI_Map_IsAuthor takes player whichPlayer returns boolean
    return RequestExtraBooleanData(50, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// CommentTotalCount,             //地图评论数
function DzAPI_Map_CommentTotalCount takes nothing returns integer
    return RequestExtraIntegerData(51, null, null, null, false, 0, 0, 0)
endfunction

// CustomRank,                    //自定义排行榜
function DzAPI_Map_CommentTotalCount takes player whichPlayer, integer id returns integer
    return RequestExtraIntegerData(52, whichPlayer, null, null, false, id, 0, 0)
endfunction

// PlayerFlags,                   //玩家标记 label（1=曾经是平台回流用户，2=当前是平台回流用户，4=曾经是地图回流用户，8=当前是地图回流用户，16=地图是否被玩家收藏）
function DzAPI_Map_PlayerFlags takes player whichPlayer, integer label returns boolean
    return RequestExtraBooleanData(53, whichPlayer, null, null, false, label, 0, 0)
endfunction

// ContinuousCount,               //持续游戏统计 id （0=总游戏天数，1=最多连续游戏天数，2=当前连续游戏天数）
function DzAPI_Map_ContinuousCount takes player whichPlayer, integer id returns integer
    return RequestExtraIntegerData(54, whichPlayer, null, null, false, id, 0, 0)
endfunction

// IsPlayer,                      //是否为玩家
function DzAPI_Map_IsPlayer takes player whichPlayer returns boolean
    return RequestExtraBooleanData(55, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// MapsTotalPlayed,               //所有地图的总游戏时长
function DzAPI_Map_MapsTotalPlayed takes player whichPlayer returns integer
    return RequestExtraIntegerData(56, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// MapsLevel,                    //指定地图的地图等级
function DzAPI_Map_MapsLevel takes player whichPlayer, integer mapId returns integer
    return RequestExtraIntegerData(57, whichPlayer, null, null, false, mapId, 0, 0)
endfunction

// MapsConsumeGold,              //所有地图的金币消耗
function DzAPI_Map_MapsConsumeGold takes player whichPlayer, integer mapId returns integer
    return RequestExtraIntegerData(58, whichPlayer, null, null, false, mapId, 0, 0)
endfunction

// MapsConsumeLumber,            //所有地图的木材消耗
function DzAPI_Map_MapsConsumeLumber takes player whichPlayer, integer mapId returns integer
    return RequestExtraIntegerData(59, whichPlayer, null, null, false, mapId, 0, 0)
endfunction

// MapsConsumeLv1,               //消费 1-199
function DzAPI_Map_MapsConsumeLv1 takes player whichPlayer, integer mapId returns boolean
    return RequestExtraBooleanData(60, whichPlayer, null, null, false, mapId, 0, 0)
endfunction

// MapsConsumeLv2,               //消费 200-499
function DzAPI_Map_MapsConsumeLv2 takes player whichPlayer, integer mapId returns boolean
    return RequestExtraBooleanData(61, whichPlayer, null, null, false, mapId, 0, 0)
endfunction

// MapsConsumeLv3,               //消费 500~999
function DzAPI_Map_MapsConsumeLv3 takes player whichPlayer, integer mapId returns boolean
    return RequestExtraBooleanData(62, whichPlayer, null, null, false, mapId, 0, 0)
endfunction

// MapsConsumeLv4,               //消费 1000+
function DzAPI_Map_MapsConsumeLv4 takes player whichPlayer, integer mapId returns boolean
    return RequestExtraBooleanData(63, whichPlayer, null, null, false, mapId, 0, 0)
endfunction

// IsPlayerUsingSkin,            //检查是否装备着皮肤（skinType：头像=1、边框=2、称号=3、底纹=4）
function DzAPI_Map_IsPlayerUsingSkin takes player whichPlayer, integer skinType, integer id returns boolean
    return RequestExtraBooleanData(64, whichPlayer, null, null, false, skinType, id, 0)
endfunction

// GetForumData,                 //获取论坛数据（0=累计获得赞数，1=精华帖数量，2=发表回复次数，3=收到的欢乐数，4=是否发过贴子，5=是否版主，6=主题数量）
function DzAPI_Map_GetForumData takes player whichPlayer, integer whichData returns integer
    return RequestExtraIntegerData(65, whichPlayer, null, null, false, whichData, 0, 0)
endfunction

// OpenMall,                     //打开商城界面
function DzAPI_Map_OpenMall takes player whichPlayer, string whichKey returns boolean
    return RequestExtraBooleanData(66, whichPlayer, whichKey, null, false, 0, 0, 0)
endfunction

//  GetLastRecommendTime, // 获取最后上安利墙时间
function DzAPI_Map_GetLastRecommendTime takes player whichPlayer returns integer
    return RequestExtraIntegerData(67, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GetLotteryUsedCount, // 获取宝箱抽取次数
function DzAPI_Map_GetLotteryUsedCount takes player whichPlayer, integer cfgIndex returns integer
    return RequestExtraIntegerData(68, whichPlayer, null, null, false, cfgIndex, 0, 0)
endfunction

// GetSinceLastPlayedSeconds, // 获取距最后一次游戏的秒数
function DzAPI_Map_GetSinceLastPlayedSeconds takes player whichPlayer returns integer
    return RequestExtraIntegerData(70, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GameResult_CommitData // 提交结算数据
function DzAPI_Map_GameResult_CommitData takes player whichPlayer, string key, string value returns nothing
    call RequestExtraIntegerData(69, whichPlayer, key, value, false, 0, 0, 0)
endfunction

// GetSinceLastPlayedSeconds, // 距最后一次游戏的秒数
function DzAPI_Map_GetSinceLastPlayedSeconds takes player whichPlayer returns integer
    call RequestExtraIntegerData(70, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// MOGItemConsume, //MOG地图使用道具
function DzAPI_Map_MOGItemConsume takes string key, integer count, string context returns boolean
    call RequestExtraBooleanData(71, null, key, context, false, count, 0, 0)
endfunction

// QuickBuy, //游戏内快速购买
function DzAPI_Map_QuickBuy takes player whichPlayer, string key, integer count, integer seconds returns boolean
    return RequestExtraBooleanData(72, whichPlayer, key, null, false, count, seconds, 0)
endfunction

// CancelQuickBuy, //取消快速购买
function DzAPI_Map_CancelQuickBuy takes player whichPlayer returns boolean
    return RequestExtraBooleanData(73, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// IsMapTest,                 //是否地图测试服MOG
function DzAPI_Map_IsMapTest takes nothing returns boolean
    return RequestExtraBooleanData(74, null, null, null, false, 0, 0, 0)
endfunction

// IsInternal,                //是否QA服MOG
function DzAPI_Map_IsInternal takes nothing returns boolean
    return RequestExtraBooleanData(75, null, null, null, false, 0, 0, 0)
endfunction

// ServerEnv,                 //服务器环境名称MOG
function DzAPI_Map_IsInternal takes nothing returns string
    return RequestExtraStringData(76, null, null, null, false, 0, 0, 0)
endfunction

//判断是否加载成功某个玩家的道具
function DzAPI_Map_PlayerLoadedItems takes player whichPlayer returns boolean
    return RequestExtraBooleanData(77, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// CustomRankCount             // 获取指定排行榜上榜人数
function DzAPI_Map_CustomRankCount takes integer id returns integer
    return RequestExtraIntegerData(78, null, null, null, false, id, 0, 0)
endfunction

// CustomRankPlayerName            // 获取排行榜上指定排名的用户名称
function DzAPI_Map_CustomRankPlayerName takes integer id, integer ranking returns string
    return RequestExtraStringData(79, null, null, null, false, id, ranking, 0)
endfunction

// CustomRankPlayerValue           // 获取排行榜上指定排名的值
function DzAPI_Map_CustomRankValue takes integer id, integer ranking returns integer
    return RequestExtraIntegerData(80, null, null, null, false, id, ranking, 0)
endfunction

// GetPlayerUserName               // 获取player的昵称
function DzAPI_Map_GetPlayerUserName takes player whichPlayer returns string
    return RequestExtraStringData(81, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GetServerValueLimitLeft,   // 获取服务器存档限制余额
function KKApiGetServerValueLimitLeft takes player whichPlayer, string key returns integer
    return RequestExtraIntegerData(82, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// RequestBackendLogic,       // 请求后端逻辑生成
function KKApiRequestBackendLogic takes player whichPlayer, string key, string group returns boolean
    return RequestExtraBooleanData(83, whichPlayer, key, group, false, 0, 0, 0)
endfunction

// CheckBackendLogicExists,   // 获取后端逻辑生成结果 是否存在
function KKApiCheckBackendLogicExists takes player whichPlayer, string key returns boolean
    return RequestExtraBooleanData(84, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// GetBackendLogicIntResult,  // 获取后端逻辑生成结果 整型
function KKApiGetBackendLogicIntResult takes player whichPlayer, string key returns integer
    return RequestExtraIntegerData(85, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// GetBackendLogicStrResult,  // 获取后端逻辑生成结果 字符串
function KKApiGetBackendLogicStrResult takes player whichPlayer, string key returns string
    return RequestExtraStringData(86, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// GetBackendLogicUpdateTime, // 获取后端逻辑生成时间
function KKApiGetBackendLogicUpdateTime takes player whichPlayer, string key returns integer
    return RequestExtraIntegerData(87, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// GetBackendLogicGroup,      // 获取后端逻辑生成组
function KKApiGetBackendLogicGroup takes player whichPlayer, string key returns string
    return RequestExtraStringData(88, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// RemoveBackendLogicResult,  // 删除后端逻辑生成结果
function KKApiRemoveBackendLogicResult takes player whichPlayer, string key returns boolean
    return RequestExtraBooleanData(89, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// IsGameMode,                // 是否游戏模式
function KKApiIsGameMode takes nothing returns boolean
    return RequestExtraBooleanData(90, null, null, null, false, 0, 0, 0)
endfunction

// InitializeGameKeys,        // 初始化游戏改键设置
function KKApiInitializeGameKey takes player whichPlayer, string data, integer setIndex returns nothing
    call RequestExtraBooleanData(91, whichPlayer, data, null, false, setIndex, 0, 0)
endfunction

// PlayerIdentityType,        // 获取玩家身份类型
function KKApiPlayerIdentityType takes player whichPlayer, integer id returns boolean
    return RequestExtraBooleanData(92, whichPlayer, null, null, false, id, 0, 0)
endfunction

// PlayerGUID,                // 获取玩家GUID
function KKApiPlayerGUID takes player whichPlayer returns string
    return RequestExtraStringData(93, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// IsTaskInProgress,          // 获取玩家地图任务是否进行中
function KKApiIsTaskInProgress takes player whichPlayer, integer setIndex returns boolean
    return RequestExtraBooleanData(94, whichPlayer, null, null, false, setIndex, 0, 0)
endfunction

// QueryTaskCurrentProgress,  // 获取玩家地图任务当前进度值
function KKApiQueryTaskCurrentProgress takes player whichPlayer, integer setIndex returns integer
    return RequestExtraIntegerData(95, whichPlayer, null, null, false, setIndex, 0, 0)
endfunction

// QueryTaskTotalProgress,  // 获取玩家地图任务总进度值
function KKApiQueryTaskTotalProgress takes player whichPlayer, integer setIndex returns integer
    return RequestExtraIntegerData(96, whichPlayer, null, null, false, setIndex, 0, 0)
endfunction

// IsAchievementCompleted,  // 获取玩家成就是否完成
function KKApiIsAchievementCompleted takes player whichPlayer, string id returns boolean
    return RequestExtraBooleanData(98, whichPlayer, id, null, false, 0, 0, 0)
endfunction

// AchievementPoints,  // 获取玩家地图成就点数
function KKApiAchievementPoints takes player whichPlayer returns integer
    return RequestExtraIntegerData(99, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// 判断游戏时长是否满足条件 minHours: 最小小时数，maxHours: 最大小时数，0表示不限制
function KKApiPlayedTime takes player whichPlayer, integer minHours, integer maxHours returns boolean
    return RequestExtraBooleanData(100, whichPlayer, null, null, false, minHours, maxHours, 0)
endfunction

// 获取随机存档剩余次数
function KKApiRandomSaveGameCount takes player whichPlayer, string group returns integer
    return RequestExtraIntegerData(101, whichPlayer, group, null, false, 0, 0, 0)
endfunction

// BeginBatchSaveArchive,  // 开始批量保存存档
function KKApiBeginBatchSaveArchive takes player whichPlayer returns boolean
    return RequestExtraBooleanData(102, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// AddBatchSaveArchive,    // 添加批量保存存档条目
function KKApiAddBatchSaveArchive takes player whichPlayer, string key, string value, boolean caseInsensitive returns boolean
    return RequestExtraBooleanData(103, whichPlayer, key, value, caseInsensitive, 0, 0, 0)
endfunction

// EndBatchSaveArchive,    // 结束批量保存存档
function KKApiEndBatchSaveArchive takes player whichPlayer, boolean abandon returns boolean
    return RequestExtraBooleanData(104, whichPlayer, null, null, abandon, 0, 0, 0)
endfunction

// GetMapName,             // 获取地图名称
function KKApiGetMapName takes nothing returns string
    return RequestExtraStringData(105, null, null, null, false, 0, 0, 0)
endfunction

// GetGuildLevel,          // 获取公会等级
function KKApiGetGuildLevel takes player whichPlayer
    return RequestExtraIntegerData(106, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GetMallItemUpdateCount, // 获取商城道具最后更新数量（新增/删除）
function KKApiGetMallItemUpdateCount takes player whichPlayer, string key returns integer
    return RequestExtraIntegerData(110, whichPlayer, key, null, false, 0, 0, 0)
endfunction

// GetMapVersion,          // 获取地图版本号
function KKApiGetMapVersion takes nothing returns string
    return RequestExtraStringData(111, null, null, null, false, 0, 0, 0)
endfunction

// GetCompetitionGameMode, // 获取赛事RPG地图游戏模式
function KKApiGetCompetitionGameMode takes nothing returns string
    return RequestExtraStringData(112, null, null, null, false, 0, 0, 0)
endfunction

// DayRounds,              // 获取当前游戏局数
function KKApiDayRounds takes player whichPlayer returns integer
    return RequestExtraIntegerData(113, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// IsLocalCloudGame,          // 当前端是否云游戏
function KKApiIsLocalCloudGame takes nothing returns boolean
    return RequestExtraBooleanData(114, null, null, null, false, 0, 0, 0)
endfunction

// ConsumeLevel,              // 消费等级
function KKApiConsumeLevel takes player whichPlayer, integer mapId returns integer
    return RequestExtraIntegerData(115, whichPlayer, null, null, false, mapId, 0, 0)
endfunction

////////////////////////////////////////////////////////////////////////////////////////

// HttpRequest,                  // 发起HTTP请求
function DzAPI_Map_HttpRequest takes player whichPlayer, string path, string data, boolean isPost, integer dataLen returns boolean
    return RequestExtraBooleanData(1001, whichPlayer, path, data, isPost, dataLen, 0, 0)
endfunction

// HttpLogin,                    // 发起登录请求
function DzAPI_Map_HttpLogin takes player whichPlayer, string path, string data returns boolean
    return RequestExtraBooleanData(1002, whichPlayer, path, data, false, 0, 0, 0)
endfunction

// NetConnect,                   // 链接网络 socketType(ENET=1, TCP=2) returns id
function DzAPI_Map_NetConnect takes integer socketType, string ip, integer port returns integer
    return RequestExtraIntegerData(1003, null, ip, null, false, socketType, port, 0)
endfunction

// NetClose,                     // 关闭网络 socketType(ENET=1, TCP=2, ALL=10)
function DzAPI_Map_NetClose takes integer socketType, integer id returns boolean
    return RequestExtraBooleanData(1004, null, null, null, false, socketType, id, 0)
endfunction

// NetSend,                      // 发送ENet数据
function DzAPI_Map_NetSend takes integer socketType, integer id, string data, integer dataLen returns boolean
    return RequestExtraBooleanData(1005, null, data, null, false, socketType, id, dataLen)
endfunction

// NetLogin,                     // 发送ENet登录请求
function DzAPI_Map_NetLogin takes integer socketType, integer id, string data returns boolean
    return RequestExtraBooleanData(1006, null, data, null, false, socketType, id, 0)
endfunction

// NetPush,                     // 发送推送数据
function DzAPI_Map_NetPush takes integer socketType, integer id, string data returns boolean
    return RequestExtraBooleanData(1007, null, data, null, false, socketType, id, 0)
endfunction

// HttpUploadFile,              // 上传文件
function DzAPI_Map_HttpUploadFile takes string url, string file returns boolean
    return RequestExtraBooleanData(1008, null, url, file, false, 0, 0, 0)
endfunction

// MlScriptEvent,         // 发送Ml脚本事件
function DzAPI_Map_MlScriptEvent takes player whichPlayer, string ev, string payload returns boolean
    return RequestExtraBooleanData(1009, whichPlayer, ev, payload, false, 0, 0, 0)
endfunction

// HttpSetDefaultTimeout, // 设置默认超时时间，单位秒，connectTimeoutSecs默认300秒，readTimeoutSecs默认5秒，writeTimeoutSecs默认5秒
function DzAPI_Map_HttpSetDefaultTimeout takes integer connectTimeoutSecs, integer readTimeoutSecs, integer writeTimeoutSecs returns boolean
    return RequestExtraBooleanData(1010, null, null, null, false, connectTimeoutSecs, readTimeoutSecs, writeTimeoutSecs)
endfunction

// HttpUploadFileAfterExit, // 进程退出后上传文件
function DzAPI_Map_HttpUploadFileAfterExit takes string url, string file returns boolean
    return RequestExtraBooleanData(1011, null, url, file, false, 0, 0, 0)
endfunction

// MOBA 从10000起

// GetMobaPlayerHero, // 获取玩家选择的英雄
function DzAPI_Map_GetMobaPlayerHero takes player whichPlayer returns integer
    return RequestExtraBooleanData(10001, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// GetMobaPlayerGold, // 获取开局金币
function DzAPI_Map_GetMobaPlayerGold takes player whichPlayer returns integer
    return RequestExtraBooleanData(10002, whichPlayer, null, null, false, 0, 0, 0)
endfunction

// MobaWatchStatics,  // MOBA观战统计
function DzAPI_Map_MobaWatchStatics takes integer staticsType, integer index, integer value returns integer
    return RequestExtraBooleanData(10003, null, null, null, false, staticsType, index, value)
endfunction

// EntertainMode,     // 娱乐模式开关
function DzAPI_Map_EntertainMode takes integer modeType returns boolean
    return RequestExtraBooleanData(10004, null, null, null, false, modeType, 0, 0)
endfunction

// RoomGameMode,      // 房间游戏模式
function DzAPI_Map_RoomGameMode takes nothing returns integer
    return RequestExtraBooleanData(10005, null, null, null, false, 0, 0, 0)
endfunction

// IsGameType,        // 是否游戏类型
function DzAPI_Map_IsGameType takes integer gameType returns boolean
    return RequestExtraBooleanData(10006, null, null, null, false, gameType, 0, 0)
endfunction

// EnableInGameStore,// 启用DOTA内置商店
function DzAPI_Map_EnableInGameStore takes integer gameType returns nothing
    call RequestExtraBooleanData(10007, null, null, null, false, 0, 0, 0)
endfunction

// GetCfgValue,       // 获取配置值  重置版
function DzAPI_Map_GetCfgValue takes string key returns integer
    return RequestExtraIntegerData(10008, null, key, null, false, 0, 0, 0)
endfunction

// SetCfgValue,       // 设置配置值  重置版
function DzAPI_Map_SetCfgValue takes string key, boolean value returns boolean
    return RequestExtraBooleanData(10009, null, key, null, value, 0, 0, 0)
endfunction

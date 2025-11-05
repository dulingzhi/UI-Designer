//注册数据同步trigger
native DzTriggerRegisterSyncData takes trigger trig, string prefix, boolean server returns nothing

//同步游戏数据
native DzSyncData takes string prefix, string data returns nothing
native DzSyncDataImmediately takes string prefix, string data returns nothing
native DzSyncBuffer takes string prefix, string data, integer dataLen returns nothing

//获取同步的数据
native DzGetTriggerSyncData takes nothing returns string

//获取同步数据的玩家
native DzGetTriggerSyncPlayer takes nothing returns player

//获取同步的前缀
native DzGetTriggerSyncPrefix takes nothing returns string

//获取推送上下文
native DzGetPushContext takes nothing returns string

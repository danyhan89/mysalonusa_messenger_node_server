# mysalonusa_messenger_node_server

node server for mysalonusa_messenger client

## query for chats

select \* from chats where parentId == null limit 20 skip 40 inner join chats c1
where chats.id == c1.parentId

#!/bin/sh
# Seed dummy data for local development/testing against a Redis Stack instance.
# Requires redis-cli on PATH. Targets port 6379 inside the container.
#
# Usage (run inside the container):
#   docker exec NO_AUTH_REDIS_STACK sh /tmp/seed_data.sh
#
# Or copy into the container first:
#   docker cp experiments/seed_data.sh NO_AUTH_REDIS_STACK:/tmp/seed_data.sh
#   docker exec NO_AUTH_REDIS_STACK sh /tmp/seed_data.sh
#
# WARNING: runs FLUSHALL — wipes all existing data before seeding.

R="redis-cli -p 6379"

$R FLUSHALL

# ─── STRINGS ─────────────────────────────────────────────────────────────────
$R SET user:session:abc123 "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c3JfMDAxIiwiZW1haWwiOiJhbGljZUBleGFtcGxlLmNvbSIsInJvbGUiOiJhZG1pbiJ9.sig"
$R EXPIRE user:session:abc123 3600
$R SET user:session:def456 "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c3JfMDAyIiwiZW1haWwiOiJib2JAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciJ9.sig"
$R EXPIRE user:session:def456 7200
$R SET user:session:ghi789 "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c3JfMDAzIiwiZW1haWwiOiJjYXJvbEBleGFtcGxlLmNvbSIsInJvbGUiOiJtb2QifQ.sig"
$R EXPIRE user:session:ghi789 1800

$R SET config:app:version "2.14.3"
$R SET config:app:maintenance_mode "false"
$R SET config:app:max_upload_size_mb "50"
$R SET config:app:feature_flags "dark_mode,ai_suggestions,beta_dashboard"
$R SET config:app:support_email "support@example.com"

$R SET rate_limit:api:usr_001 "47"
$R EXPIRE rate_limit:api:usr_001 60
$R SET rate_limit:api:usr_002 "12"
$R EXPIRE rate_limit:api:usr_002 60
$R SET rate_limit:api:usr_003 "98"
$R EXPIRE rate_limit:api:usr_003 60

$R SET cache:homepage:hero "Summer Sale - Up to 70% off on Electronics!"
$R EXPIRE cache:homepage:hero 1800
$R SET cache:product:p1001:name "Sony WH-1000XM5 Wireless Headphones"
$R SET cache:product:p1002:name "Apple MacBook Pro 14-inch M3"
$R SET cache:product:p1003:name "Samsung 4K OLED TV 65-inch"

$R SET lock:job:email_sender "worker-node-3"
$R EXPIRE lock:job:email_sender 30
$R SET lock:job:report_generator "worker-node-1"
$R EXPIRE lock:job:report_generator 120

$R SET counter:page_views:homepage "158432"
$R SET counter:page_views:products "89217"
$R SET counter:signups:today "342"
$R SET counter:orders:today "1847"

$R SET oauth:state:csrf_abc789 '{"clientId":"app_mobile_ios","redirectUri":"myapp://oauth/callback","scope":"read:profile write:orders","codeChallenge":"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM","createdAt":"2026-04-21T09:13:00Z"}'
$R EXPIRE oauth:state:csrf_abc789 600

$R SET payment:intent:pi_3NqXyZ '{"id":"pi_3NqXyZ","amount":214900,"currency":"usd","status":"requires_capture","customer":"cus_usr001","metadata":{"orderId":"ord_8823","userId":"usr_001"},"createdAt":"2026-04-21T09:12:00Z"}'
$R EXPIRE payment:intent:pi_3NqXyZ 3600

$R SET cache:recommendations:usr_001 '{"userId":"usr_001","generatedAt":"2026-04-21T09:00:00Z","algorithm":"collaborative_filtering_v3","recommendations":[{"productId":"p1005","score":0.94,"reason":"users_like_you"},{"productId":"p1008","score":0.87,"reason":"frequently_bought_together"}]}'
$R EXPIRE cache:recommendations:usr_001 900

$R SET webhook:delivery:wh_d_001 '{"id":"wh_d_001","webhookId":"wh_001","endpoint":"https://partner.example.com/hooks/orders","event":"order.shipped","payload":{"orderId":"ord_8821","status":"shipped","trackingNumber":"1Z999AA10123456784"},"status":"delivered"}'

# ─── HASHES ──────────────────────────────────────────────────────────────────
$R HSET user:profile:usr_001 id usr_001 email alice@example.com first_name Alice last_name Johnson role admin plan enterprise created_at "2023-01-15T08:30:00Z" last_login "2026-04-21T09:14:22Z" timezone "America/New_York" locale en-US mfa_enabled true login_count 847

$R HSET user:profile:usr_002 id usr_002 email bob@example.com first_name Bob last_name Smith role user plan pro created_at "2023-06-22T14:00:00Z" last_login "2026-04-20T18:45:10Z" timezone "Europe/London" locale en-GB mfa_enabled false login_count 312

$R HSET user:profile:usr_003 id usr_003 email carol@example.com first_name Carol last_name Williams role moderator plan free created_at "2024-02-01T11:00:00Z" last_login "2026-04-19T07:22:05Z" timezone "Asia/Tokyo" locale ja-JP mfa_enabled true login_count 94

$R HSET product:p1001 id p1001 name "Sony WH-1000XM5 Wireless Headphones" brand Sony category electronics sku "SONY-WH1000XM5-BLK" price "349.99" sale_price "279.99" stock 143 rating "4.7" review_count 2841 is_active true

$R HSET product:p1002 id p1002 name "Apple MacBook Pro 14-inch M3" brand Apple category electronics sku "APPL-MBP14-M3-SLV" price "1999.00" sale_price "" stock 28 rating "4.9" review_count 514 is_active true

$R HSET product:p1003 id p1003 name "Samsung 4K OLED TV 65-inch" brand Samsung category electronics sku "SAMS-65OLED-2024" price "2499.00" sale_price "1899.00" stock 7 rating "4.6" review_count 387 is_active true

$R HSET order:ord_8821 id ord_8821 user_id usr_001 status shipped total "2153.71" currency USD items_count 2 shipping_address "123 Main St, New York, NY 10001" created_at "2026-04-18T10:30:00Z" shipped_at "2026-04-19T14:00:00Z" tracking "1Z999AA10123456784"

$R HSET order:ord_8822 id ord_8822 user_id usr_003 status processing total "349.99" currency USD items_count 1 shipping_address "7-2 Shinjuku, Tokyo 160-0022" created_at "2026-04-21T08:00:00Z"

$R HSET order:ord_8823 id ord_8823 user_id usr_001 status pending total "214900" currency USD items_count 3 created_at "2026-04-21T09:12:00Z"

$R HSET session:web:abc123 user_id usr_001 ip "203.0.113.42" user_agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124" created_at "2026-04-21T09:00:00Z" last_active "2026-04-21T09:14:22Z" cart_id cart_usr001_active

$R HSET worker:node-1 hostname "worker-01.internal" status active jobs_processed 14823 jobs_failed 12 last_heartbeat "2026-04-21T09:14:00Z" cpu_usage "34.2" memory_usage_mb "1024" version "3.2.1"

$R HSET worker:node-2 hostname "worker-02.internal" status active jobs_processed 18291 jobs_failed 7 last_heartbeat "2026-04-21T09:14:05Z" cpu_usage "51.8" memory_usage_mb "2048" version "3.2.1"

$R HSET worker:node-3 hostname "worker-03.internal" status idle jobs_processed 9102 jobs_failed 31 last_heartbeat "2026-04-21T09:13:55Z" cpu_usage "8.1" memory_usage_mb "512" version "3.2.0"

# Hash fields with JSON string values
$R HSET product:p1001:metadata tags '["wireless","noise-canceling","premium","travel","work-from-home"]' specs '{"driverSize":"30mm","batteryLife":"30hrs","noiseCancellation":true,"bluetoothVersion":"5.2"}' reviews_summary '{"average":4.7,"total":2841,"topReview":{"author":"techreviewer99","text":"Best headphones I have ever owned. ANC is incredible.","rating":5,"helpful":382}}'

$R HSET product:p1002:metadata tags '["apple","laptop","m3","professional","creative"]' specs '{"chip":"Apple M3 Pro","ram":"18GB","storage":"512GB SSD","display":"14.2-inch Liquid Retina XDR","batteryLife":"18hrs"}' reviews_summary '{"average":4.9,"total":514,"topReview":{"author":"devpro2024","text":"Insanely fast. Handles everything without breaking a sweat.","rating":5,"helpful":201}}'

$R HSET user:usr_001:settings notification_prefs '{"email":true,"push":true,"sms":false,"digest":"weekly","types":["orders","promotions","security"]}' dashboard_layout '{"widgets":["revenue_chart","top_products","recent_orders","user_growth"],"theme":"dark","compactMode":false}' api_keys '{"production":"sk_prod_xxxxxxxxxxxx","staging":"sk_stg_xxxxxxxxxxxx"}'

$R HSET job:email:batch_20260421 config '{"template":"weekly_digest","recipientSegment":"active_pro_users","subject":"Your weekly highlights"}' progress '{"total":4821,"sent":3102,"failed":14,"skipped":23}' started_at "2026-04-21T08:00:00Z" status running

$R HSET cache:api:response:products page_meta '{"page":1,"perPage":20,"total":847,"totalPages":43}' filters_applied '{"category":"electronics","priceMin":100,"priceMax":500,"inStock":true}' cached_at "2026-04-21T09:10:00Z"

# ─── SETS ────────────────────────────────────────────────────────────────────
$R SADD roles:admin usr_001 usr_007 usr_012 usr_019
$R SADD roles:moderator usr_003 usr_008 usr_015
$R SADD roles:user usr_002 usr_004 usr_005 usr_006 usr_009 usr_010

$R SADD product:p1001:tags wireless noise-canceling premium audio sony bluetooth travel work-from-home
$R SADD product:p1002:tags apple laptop m3 professional creative photography video-editing
$R SADD product:p1003:tags samsung tv oled 4k smart-tv gaming home-theater

$R SADD category:electronics:products p1001 p1002 p1003 p1004 p1005 p1006
$R SADD category:audio:products p1001 p1007 p1008 p1009
$R SADD category:laptops:products p1002 p1010 p1011

$R SADD user:usr_001:wishlist p1002 p1005 p1007 p1011
$R SADD user:usr_002:wishlist p1001 p1003
$R SADD user:usr_003:wishlist p1002 p1004 p1008

$R SADD newsletter:subscribers:tech alice@example.com bob@example.com dave@example.com frank@example.com helen@example.com
$R SADD newsletter:subscribers:deals alice@example.com carol@example.com dave@example.com ivan@example.com jane@example.com
$R SADD newsletter:unsubscribed mallory@example.com oscar@example.com

$R SADD active_sessions abc123 def456 ghi789 jkl012 mno345
$R SADD blocked_ips "192.168.100.50" "10.0.0.99" "172.16.5.23"
$R SADD allowed_cors_origins "https://app.example.com" "https://admin.example.com" "https://api.example.com" "http://localhost:3000"

$R SADD user:usr_001:following usr_002 usr_003 usr_007 usr_012
$R SADD user:usr_002:following usr_001 usr_003
$R SADD user:usr_003:following usr_001 usr_002 usr_008 usr_015

# ─── SORTED SETS ─────────────────────────────────────────────────────────────
$R ZADD leaderboard:global 98450 usr_004 87320 usr_001 76100 usr_008 65890 usr_012 54320 usr_003 43210 usr_002 32100 usr_015 21500 usr_007

$R ZADD leaderboard:monthly:2026-04 18420 usr_004 15830 usr_001 12910 usr_012 9870 usr_008 8240 usr_002

$R ZADD products:by_rating 4.9 p1002 4.7 p1001 4.6 p1003 4.5 p1004 4.3 p1007 4.1 p1009

$R ZADD products:by_price 279.99 p1001 1999.00 p1002 1899.00 p1003 89.99 p1007 499.00 p1004 1299.00 p1005

$R ZADD queue:email:priority 1 "job:email:welcome:usr_011" 2 "job:email:order_confirm:ord_8822" 3 "job:email:batch_20260421" 5 "job:email:newsletter:tech" 5 "job:email:newsletter:deals"

$R ZADD scheduled:jobs 1745193600 "cleanup:expired_sessions" 1745197200 "report:daily_revenue" 1745200800 "sync:inventory:shopify" 1745204400 "backup:database:full"

$R ZADD trending:products:24h 4821 p1001 3912 p1002 2847 p1003 1923 p1007 1102 p1004

$R ZADD search:autocomplete:e 100 "electronics" 95 "earbuds" 88 "earphones" 72 "electric" 60 "ethernet"
$R ZADD search:autocomplete:so 90 "sony" 45 "software" 30 "sofa"
$R ZADD search:autocomplete:ap 95 "apple" 88 "app" 60 "apparel"

$R ZADD geo:stores:distance 2.3 "store:NYC-001" 5.1 "store:NYC-002" 12.8 "store:NJ-001" 28.4 "store:LI-001"

# ─── LISTS ───────────────────────────────────────────────────────────────────
$R RPUSH queue:jobs:background '{"id":"job_201","type":"generate_invoice","payload":{"orderId":"ord_8821","userId":"usr_001"},"priority":1,"attempts":0,"createdAt":"2026-04-21T09:10:00Z"}' '{"id":"job_202","type":"resize_image","payload":{"imageUrl":"https://cdn.example.com/raw/p1004.jpg","sizes":[200,400,800,1200]},"priority":2,"attempts":0,"createdAt":"2026-04-21T09:11:00Z"}' '{"id":"job_203","type":"sync_inventory","payload":{"source":"shopify","productIds":["p1001","p1002","p1003"]},"priority":3,"attempts":1,"createdAt":"2026-04-21T08:55:00Z"}'

$R RPUSH queue:notifications:email '{"id":"notif_001","type":"welcome","to":"eve@example.com","template":"welcome_v2","payload":{"firstName":"Eve"}}' '{"id":"notif_002","type":"order_shipped","to":"alice@example.com","template":"order_shipped_v1","payload":{"orderId":"ord_8821","tracking":"1Z999AA10123456784"}}' '{"id":"notif_003","type":"password_reset","to":"bob@example.com","template":"password_reset_v1","payload":{"resetLink":"https://app.example.com/reset/tokenxyz","expiresIn":"15m"}}'

$R RPUSH user:usr_001:activity_log "2026-04-21T09:14:22Z|login|ip:203.0.113.42" "2026-04-21T09:10:05Z|view_product|productId:p1002" "2026-04-21T09:08:41Z|search|query:macbook+pro" "2026-04-21T09:07:00Z|add_to_cart|productId:p1001" "2026-04-20T18:30:00Z|purchase|orderId:ord_8821|total:2153.71"

$R RPUSH chat:room:support-general "2026-04-21T08:01:12Z|usr_003|Hello, I need help with my order" "2026-04-21T08:02:45Z|agent_007|Hi Carol! Can you share your order number?" "2026-04-21T08:03:10Z|usr_003|It is ord_8822" "2026-04-21T08:05:22Z|agent_007|Your order is processing. Expected ship date April 23rd." "2026-04-21T08:06:00Z|usr_003|Thank you!"

$R RPUSH cache:recent_searches:usr_001 "macbook pro m3" "noise canceling headphones" "4k tv" "sony headphones" "laptop stand"
$R RPUSH cache:recent_searches:usr_002 "react hooks tutorial" "redis pub sub" "docker compose example" "typescript generics"
$R RPUSH cache:recent_searches:usr_003 "tokyo restaurants" "train schedule" "weather forecast"

# ─── STREAMS ─────────────────────────────────────────────────────────────────
$R XADD events:user-activity "*" event_type page_view user_id usr_001 page /products session_id abc123 referrer "google.com"
$R XADD events:user-activity "*" event_type search user_id usr_001 query "macbook pro m3" results_count 12 session_id abc123
$R XADD events:user-activity "*" event_type product_view user_id usr_001 product_id p1002 duration_ms 45000 session_id abc123
$R XADD events:user-activity "*" event_type add_to_cart user_id usr_001 product_id p1001 quantity 1 session_id abc123
$R XADD events:user-activity "*" event_type purchase_completed user_id usr_001 order_id ord_8822 total 2153.71 session_id abc123
$R XADD events:user-activity "*" event_type page_view user_id usr_002 page /blog/redis-caching session_id def456
$R XADD events:user-activity "*" event_type signup user_id usr_011 email eve@example.com plan pro session_id xyz789

$R XADD events:orders "*" event_type order_created order_id ord_8822 user_id usr_003 total 349.99 items_count 1
$R XADD events:orders "*" event_type payment_captured order_id ord_8822 payment_method credit_card amount 349.99
$R XADD events:orders "*" event_type inventory_reserved order_id ord_8822 product_id p1001 quantity 1
$R XADD events:orders "*" event_type order_confirmed order_id ord_8822 confirmation_email_sent true
$R XADD events:orders "*" event_type order_shipped order_id ord_8821 carrier UPS tracking 1Z999AA10123456784

$R XADD metrics:app:performance "*" endpoint /api/v2/products method GET duration_ms 23 status 200 user_id usr_001
$R XADD metrics:app:performance "*" endpoint /api/v2/orders method POST duration_ms 145 status 201 user_id usr_003
$R XADD metrics:app:performance "*" endpoint /api/v2/search method GET duration_ms 67 status 200 user_id usr_002
$R XADD metrics:app:performance "*" endpoint /api/v2/products/p1001 method GET duration_ms 18 status 200 user_id usr_001
$R XADD metrics:app:performance "*" endpoint /api/auth/token method POST duration_ms 312 status 200 user_id usr_011
$R XADD metrics:app:performance "*" endpoint /api/v2/cart method PATCH duration_ms 89 status 200 user_id usr_001

# ─── JSON (RedisJSON) ────────────────────────────────────────────────────────
$R JSON.SET user:json:usr_001 $ '{"id":"usr_001","email":"alice@example.com","profile":{"firstName":"Alice","lastName":"Johnson","bio":"Senior product manager with 10 years experience in SaaS","socialLinks":{"twitter":"@alicejohnson","linkedin":"linkedin.com/in/alicejohnson","github":"github.com/alicejohnson"}},"subscription":{"plan":"enterprise","status":"active","seats":25,"features":["sso","audit_logs","priority_support","custom_domain"],"billingCycle":"annual","nextBillingDate":"2027-01-15","amount":4788.00},"preferences":{"theme":"dark","language":"en-US","timezone":"America/New_York","notifications":{"email":true,"push":true,"sms":false,"digest":"weekly"}},"metadata":{"createdAt":"2023-01-15T08:30:00Z","lastLoginAt":"2026-04-21T09:14:22Z","loginCount":847,"mfaEnabled":true}}'

$R JSON.SET user:json:usr_002 $ '{"id":"usr_002","email":"bob@example.com","profile":{"firstName":"Bob","lastName":"Smith","bio":"Full-stack developer and open source contributor","socialLinks":{"github":"github.com/bobsmith","twitter":"@bobsmith_dev"}},"subscription":{"plan":"pro","status":"active","seats":1,"features":["api_access","webhooks","advanced_analytics"],"billingCycle":"monthly","nextBillingDate":"2026-05-22","amount":49.00},"preferences":{"theme":"light","language":"en-GB","timezone":"Europe/London","notifications":{"email":true,"push":false,"sms":false,"digest":"daily"}},"metadata":{"createdAt":"2023-06-22T14:00:00Z","lastLoginAt":"2026-04-20T18:45:10Z","loginCount":312,"mfaEnabled":false}}'

$R JSON.SET product:json:p1001 $ '{"id":"p1001","name":"Sony WH-1000XM5 Wireless Headphones","brand":"Sony","category":{"primary":"electronics","secondary":"audio","tertiary":"over-ear-headphones"},"pricing":{"msrp":349.99,"current":279.99,"currency":"USD","discount":{"type":"percentage","value":20,"endsAt":"2026-04-30"}},"inventory":{"sku":"SONY-WH1000XM5-BLK","stock":143,"warehouse":"US-WEST-2","reorderPoint":50},"specs":{"driverSize":"30mm","frequencyResponse":"4Hz-40kHz","batteryLife":"30hrs","noiseCancellation":true,"connectivity":["bluetooth5.2","3.5mm","USB-C"],"colors":["black","platinum-silver","midnight-blue"]},"ratings":{"average":4.7,"count":2841,"breakdown":{"5":1932,"4":681,"3":156,"2":48,"1":24}},"tags":["wireless","noise-canceling","premium","work-from-home","travel"]}'

$R JSON.SET product:json:p1002 $ '{"id":"p1002","name":"Apple MacBook Pro 14-inch M3","brand":"Apple","category":{"primary":"electronics","secondary":"computers","tertiary":"laptops"},"pricing":{"msrp":1999.00,"current":1999.00,"currency":"USD"},"inventory":{"sku":"APPL-MBP14-M3-SLV","stock":28,"warehouse":"US-EAST-1","reorderPoint":10},"specs":{"chip":"Apple M3 Pro","cores":{"cpu":11,"gpu":14},"ram":"18GB","storage":"512GB SSD","display":{"size":"14.2-inch","type":"Liquid Retina XDR","resolution":"3024x1964","refreshRate":"120Hz"},"batteryLife":"18hrs","ports":["Thunderbolt4x3","HDMI","SD","MagSafe3"]},"ratings":{"average":4.9,"count":514,"breakdown":{"5":451,"4":45,"3":12,"2":4,"1":2}},"tags":["apple","m3","professional","creative","laptop"]}'

$R JSON.SET order:json:ord_8821 $ '{"id":"ord_8821","userId":"usr_001","status":"shipped","items":[{"productId":"p1001","name":"Sony WH-1000XM5","quantity":1,"unitPrice":279.99,"subtotal":279.99},{"productId":"p1003","name":"Samsung OLED TV 65-inch","quantity":1,"unitPrice":1899.00,"subtotal":1899.00}],"pricing":{"subtotal":2178.99,"discount":{"code":"SPRING20","amount":218.90},"tax":192.62,"shipping":0.00,"total":2153.71},"shipping":{"method":"express","carrier":"UPS","trackingNumber":"1Z999AA10123456784","estimatedDelivery":"2026-04-23","address":{"line1":"123 Main St","city":"New York","state":"NY","zip":"10001","country":"US"}},"payment":{"method":"credit_card","last4":"4242","brand":"Visa","status":"captured"},"timeline":[{"status":"created","timestamp":"2026-04-18T10:30:00Z"},{"status":"payment_captured","timestamp":"2026-04-18T10:30:05Z"},{"status":"processing","timestamp":"2026-04-18T12:00:00Z"},{"status":"shipped","timestamp":"2026-04-19T14:00:00Z"}]}'

$R JSON.SET config:feature_flags $ '{"flags":{"dark_mode":{"enabled":true,"rollout":100,"description":"Dark mode UI theme"},"ai_suggestions":{"enabled":true,"rollout":50,"description":"AI-powered search suggestions","segments":["pro","enterprise"]},"beta_dashboard":{"enabled":true,"rollout":10,"description":"New analytics dashboard beta","segments":["enterprise"],"expiresAt":"2026-06-01"},"new_checkout":{"enabled":false,"rollout":0,"description":"Redesigned checkout flow"},"stream_import":{"enabled":true,"rollout":100,"description":"Import data via streaming CSV"}},"lastUpdated":"2026-04-20T08:00:00Z","updatedBy":"usr_001"}'

$R JSON.SET analytics:event:schema $ '{"version":"1.2.0","eventTypes":{"page_view":{"required":["userId","page","timestamp"],"optional":["referrer","utm_source","sessionId"]},"purchase":{"required":["userId","orderId","total","currency","items"],"optional":["couponCode","affiliateId"]},"click":{"required":["userId","element","page","timestamp"],"optional":["xPos","yPos"]},"signup":{"required":["userId","email","plan","timestamp"],"optional":["referralCode","invitedBy"]}}}'

$R JSON.SET inventory:warehouse:US-WEST-2 $ '{"warehouseId":"US-WEST-2","location":{"city":"Reno","state":"NV","country":"US","coordinates":{"lat":39.5296,"lon":-119.8138}},"capacity":{"total":50000,"used":31284,"available":18716},"zones":{"A":{"items":12400,"type":"electronics"},"B":{"items":8921,"type":"apparel"},"C":{"items":9963,"type":"home_goods"}},"staff":{"total":142,"shifts":{"morning":48,"afternoon":52,"night":42}},"lastAudit":"2026-04-15T06:00:00Z","status":"operational"}'

echo "Done! Total keys:"
redis-cli -p 6379 DBSIZE

;; Clout Prediction Market V2
;; Fixes: Infinite Claim Bug, Betting Window Logic

(define-constant ERR-NOT-ADMIN (err u100))
(define-constant ERR-MARKET-NOT-FOUND (err u101))
(define-constant ERR-MARKET-CLOSED (err u102))
(define-constant ERR-ALREADY-PREDICTED (err u103))
(define-constant ERR-INVALID-AMOUNT (err u104))
(define-constant ERR-ALREADY-CLAIMED (err u105))
(define-constant ERR-PREDICTION-NOT-FOUND (err u106))

(define-data-var admin principal tx-sender)
(define-data-var market-counter uint u0)

;; --- DATA MAPS ---

(define-map markets
  uint
  {
    description: (string-ascii 100),
    betting-open: bool, ;; NEW: Controls when people can bet
    resolved: bool,
    outcome: bool
  }
)

(define-map predictions
  { market-id: uint, user: principal }
  { 
    choice: bool, 
    stake: uint,
    claimed: bool ;; NEW: Prevents double spending
  }
)

(define-map user-clout
  principal
  uint
)

;; --- PRIVATE HELPERS ---

(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

(define-private (get-clout (user principal))
  (default-to u100 (map-get? user-clout user))
)

;; --- PUBLIC FUNCTIONS ---

;; Create a new prediction market
(define-public (create-market (description (string-ascii 100)))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (let ((id (var-get market-counter)))
      (map-set markets id {
        description: description,
        betting-open: true, ;; Open by default
        resolved: false,
        outcome: false
      })
      (var-set market-counter (+ id u1))
      (ok id)
    )
  )
)

;; NEW: Close betting (Admin calls this BEFORE the event starts)
(define-public (close-betting (market-id uint))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (let ((market (unwrap! (map-get? markets market-id) ERR-MARKET-NOT-FOUND)))
      (map-set markets market-id (merge market { betting-open: false }))
      (ok true)
    )
  )
)

;; Place a prediction
(define-public (predict (market-id uint) (choice bool) (stake uint))
  (begin
    (asserts! (> stake u0) ERR-INVALID-AMOUNT)

    (let (
      (market (unwrap! (map-get? markets market-id) ERR-MARKET-NOT-FOUND))
      (current-clout (get-clout tx-sender))
    )
      ;; CHECK: Is betting actually open?
      (asserts! (get betting-open market) ERR-MARKET-CLOSED)
      
      (asserts! (is-none (map-get? predictions { market-id: market-id, user: tx-sender })) ERR-ALREADY-PREDICTED)
      (asserts! (>= current-clout stake) ERR-INVALID-AMOUNT)

      ;; Lock stake
      (map-set user-clout tx-sender (- current-clout stake))

      ;; Save prediction
      (map-set predictions
        { market-id: market-id, user: tx-sender }
        { choice: choice, stake: stake, claimed: false }
      )
      (ok true)
    )
  )
)

;; Resolve market (Admin calls this AFTER event results are known)
(define-public (resolve-market (market-id uint) (outcome bool))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (let ((market (unwrap! (map-get? markets market-id) ERR-MARKET-NOT-FOUND)))
      (map-set markets market-id (merge market { 
        betting-open: false, ;; Ensure it's closed
        resolved: true, 
        outcome: outcome 
      }))
      (ok true)
    )
  )
)

;; Claim reward
(define-public (claim (market-id uint))
  (let (
    (market (unwrap! (map-get? markets market-id) ERR-MARKET-NOT-FOUND))
    (prediction (unwrap! (map-get? predictions { market-id: market-id, user: tx-sender }) ERR-PREDICTION-NOT-FOUND))
  )
    ;; Checks
    (asserts! (get resolved market) ERR-MARKET-CLOSED)
    (asserts! (not (get claimed prediction)) ERR-ALREADY-CLAIMED) ;; FIX: Stop infinite loop

    (let (
      (won (is-eq (get choice prediction) (get outcome market)))
      (stake (get stake prediction))
      (current-clout (get-clout tx-sender))
    )
      ;; Mark as claimed immediately
      (map-set predictions 
        { market-id: market-id, user: tx-sender }
        (merge prediction { claimed: true })
      )

      ;; Payout if won
      (if won
        (begin
           (map-set user-clout tx-sender (+ current-clout (* stake u2)))
           (ok true)
        )
        (ok false) ;; You lost, but transaction succeeds so you can't claim again
      )
    )
  )
)

;; --- READ ONLY (Essential for Frontend) ---

(define-read-only (get-market (market-id uint))
    (map-get? markets market-id)
)

(define-read-only (get-prediction (market-id uint) (user principal))
    (map-get? predictions { market-id: market-id, user: user })
)

(define-read-only (get-user-clout (user principal))
  (ok (get-clout user))
)
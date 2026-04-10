use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // State machine violations
    #[msg("Session is not in OPEN state")]
    NotOpen,
    #[msg("Session is not in LOCKED state")]
    NotLocked,
    #[msg("Session is not in CONFIRMING state")]
    NotConfirming,
    #[msg("Session is not in REVEALING state")]
    NotRevealing,
    #[msg("Session is not in PAYING state")]
    NotPaying,
    #[msg("Session is not in SETTLING state")]
    NotSettling,
    #[msg("Session is already cancelled or settled")]
    AlreadyTerminal,

    // Authorization
    #[msg("Only the session host can call this instruction")]
    NotHost,
    #[msg("VRF callback must be signed by the VRF program identity")]
    InvalidVrfIdentity,

    // Session rules
    #[msg("Need at least 2 participants to lock")]
    NotEnoughParticipants,
    #[msg("Session is full")]
    SessionFull,
    #[msg("Wallet has already joined this session")]
    AlreadyJoined,
    #[msg("Session has expired")]
    SessionExpired,

    // Bill confirmation
    #[msg("Participant has already confirmed the bill")]
    AlreadyConfirmed,
    #[msg("Bill has not been confirmed by this participant")]
    NotConfirmedByParticipant,

    // Payment
    #[msg("Participant has already paid")]
    AlreadyPaid,
    #[msg("Payment amount does not match amount due")]
    WrongAmount,
    #[msg("Payment deadline has passed")]
    DeadlinePassed,
    #[msg("Not all participants have paid yet")]
    NotAllPaid,

    // Distribution
    #[msg("Share distribution does not sum to total")]
    DistributionMismatch,
    #[msg("Arithmetic overflow")]
    Overflow,

    // Accounts
    #[msg("Wrong number of participant accounts passed")]
    WrongParticipantCount,
    #[msg("Invalid participant PDA in remaining accounts")]
    InvalidParticipantPda,
}
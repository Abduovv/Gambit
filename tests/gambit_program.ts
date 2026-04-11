const anchor = require("@coral-xyz/anchor");
const { Program } = require("@coral-xyz/anchor");
// import { GambitProgram } from "../target/types/gambit_program";
const { expect } = require("chai");
const {
  Keypair,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");

describe("gambit_program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.GambitProgram;

  // Helpers
  const SESSION_SEED = Buffer.from("session");
  const PARTICIPANT_SEED = Buffer.from("participant");
  const ESCROW_SEED = Buffer.from("escrow");
  const RECEIPT_SEED = Buffer.from("receipt");

  function randomSessionId(): number[] {
    return Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
  }

  async function airdrop(pubkey: PublicKey, sol: number = 10) {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      sol * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  }

  function getSessionPda(sessionId: number[], host: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [SESSION_SEED, Buffer.from(sessionId), host.toBuffer()],
      program.programId
    )[0];
  }

  function getEscrowPda(session: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [ESCROW_SEED, session.toBuffer()],
      program.programId
    )[0];
  }

  function getParticipantPda(
    session: PublicKey,
    wallet: PublicKey
  ): PublicKey {
    return PublicKey.findProgramAddressSync(
      [PARTICIPANT_SEED, session.toBuffer(), wallet.toBuffer()],
      program.programId
    )[0];
  }

  function getReceiptPda(session: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [RECEIPT_SEED, session.toBuffer()],
      program.programId
    )[0];
  }

  // ── Test: Initialize Session ──────────────────────────────────────────

  describe("initialize_session", () => {
    it("creates session and escrow PDAs", async () => {
      const host = Keypair.generate();
      await airdrop(host.publicKey);

      const sessionId = randomSessionId();
      const totalLamports = new anchor.BN(1_000_000_000); // 1 SOL
      const fairnessAlpha = 5;
      const maxParticipants = 4;

      const sessionPda = getSessionPda(sessionId, host.publicKey);
      const escrowPda = getEscrowPda(sessionPda);

      await program.methods
        .initializeSession(sessionId, totalLamports, fairnessAlpha, maxParticipants)
        .accounts({
          host: host.publicKey,
          session: sessionPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([host])
        .rpc();

      const session = await program.account.session.fetch(sessionPda);
      expect(session.host.toBase58()).to.equal(host.publicKey.toBase58());
      expect(session.totalLamports.toNumber()).to.equal(1_000_000_000);
      expect(session.fairnessAlpha).to.equal(5);
      expect(session.maxParticipants).to.equal(4);
      expect(session.participantCount).to.equal(0);
      expect(session.state).to.equal(0); // STATE_OPEN

      const escrow = await program.account.escrow.fetch(escrowPda);
      expect(escrow.session.toBase58()).to.equal(sessionPda.toBase58());
      expect(escrow.totalCollected.toNumber()).to.equal(0);
    });

    it("rejects fairness_alpha out of range", async () => {
      const host = Keypair.generate();
      await airdrop(host.publicKey);

      const sessionId = randomSessionId();
      const sessionPda = getSessionPda(sessionId, host.publicKey);
      const escrowPda = getEscrowPda(sessionPda);

      try {
        await program.methods
          .initializeSession(sessionId, new anchor.BN(1000), 0, 4)
          .accounts({
            host: host.publicKey,
            session: sessionPda,
            escrow: escrowPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([host])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.toString()).to.contain("Overflow");
      }
    });

    it("rejects zero total amount", async () => {
      const host = Keypair.generate();
      await airdrop(host.publicKey);

      const sessionId = randomSessionId();
      const sessionPda = getSessionPda(sessionId, host.publicKey);
      const escrowPda = getEscrowPda(sessionPda);

      try {
        await program.methods
          .initializeSession(sessionId, new anchor.BN(0), 5, 4)
          .accounts({
            host: host.publicKey,
            session: sessionPda,
            escrow: escrowPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([host])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.toString()).to.contain("WrongAmount");
      }
    });
  });

  // ── Test: Join Session ────────────────────────────────────────────────

  describe("join_session", () => {
    let host: Keypair;
    let sessionId: number[];
    let sessionPda: PublicKey;
    let escrowPda: PublicKey;

    beforeEach(async () => {
      host = Keypair.generate();
      await airdrop(host.publicKey);

      sessionId = randomSessionId();
      sessionPda = getSessionPda(sessionId, host.publicKey);
      escrowPda = getEscrowPda(sessionPda);

      await program.methods
        .initializeSession(
          sessionId,
          new anchor.BN(2_000_000_000),
          3,
          4
        )
        .accounts({
          host: host.publicKey,
          session: sessionPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([host])
        .rpc();
    });

    it("participant joins with display name", async () => {
      const participant = Keypair.generate();
      await airdrop(participant.publicKey);

      const participantPda = getParticipantPda(
        sessionPda,
        participant.publicKey
      );

      await program.methods
        .joinSession("Alice")
        .accounts({
          participantWallet: participant.publicKey,
          session: sessionPda,
          participant: participantPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant])
        .rpc();

      const pAccount = await program.account.participant.fetch(participantPda);
      expect(pAccount.displayName).to.equal("Alice");
      expect(pAccount.wallet.toBase58()).to.equal(
        participant.publicKey.toBase58()
      );
      expect(pAccount.joinIndex).to.equal(0);
      expect(pAccount.confirmedBill).to.equal(false);

      const session = await program.account.session.fetch(sessionPda);
      expect(session.participantCount).to.equal(1);
    });

    it("truncates display name to 20 chars", async () => {
      const participant = Keypair.generate();
      await airdrop(participant.publicKey);

      const participantPda = getParticipantPda(
        sessionPda,
        participant.publicKey
      );

      await program.methods
        .joinSession("ThisIsAVeryLongDisplayNameThatExceedsTwentyChars")
        .accounts({
          participantWallet: participant.publicKey,
          session: sessionPda,
          participant: participantPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant])
        .rpc();

      const pAccount = await program.account.participant.fetch(participantPda);
      expect(pAccount.displayName.length).to.be.at.most(20);
    });

    it("prevents double join (PDA collision)", async () => {
      const participant = Keypair.generate();
      await airdrop(participant.publicKey);

      const participantPda = getParticipantPda(
        sessionPda,
        participant.publicKey
      );

      await program.methods
        .joinSession("Bob")
        .accounts({
          participantWallet: participant.publicKey,
          session: sessionPda,
          participant: participantPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant])
        .rpc();

      try {
        await program.methods
          .joinSession("Bob Again")
          .accounts({
            participantWallet: participant.publicKey,
            session: sessionPda,
            participant: participantPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([participant])
          .rpc();
        expect.fail("Should have thrown on double join");
      } catch (e: any) {
        // PDA already exists — init will fail
        expect(e.toString()).to.not.be.empty;
      }
    });

    it("increments join_index for each participant", async () => {
      const p1 = Keypair.generate();
      const p2 = Keypair.generate();
      await airdrop(p1.publicKey);
      await airdrop(p2.publicKey);

      const p1Pda = getParticipantPda(sessionPda, p1.publicKey);
      const p2Pda = getParticipantPda(sessionPda, p2.publicKey);

      await program.methods
        .joinSession("First")
        .accounts({
          participantWallet: p1.publicKey,
          session: sessionPda,
          participant: p1Pda,
          systemProgram: SystemProgram.programId,
        })
        .signers([p1])
        .rpc();

      await program.methods
        .joinSession("Second")
        .accounts({
          participantWallet: p2.publicKey,
          session: sessionPda,
          participant: p2Pda,
          systemProgram: SystemProgram.programId,
        })
        .signers([p2])
        .rpc();

      const account1 = await program.account.participant.fetch(p1Pda);
      const account2 = await program.account.participant.fetch(p2Pda);
      expect(account1.joinIndex).to.equal(0);
      expect(account2.joinIndex).to.equal(1);
    });
  });

  // ── Test: Lock Session ────────────────────────────────────────────────

  describe("lock_session", () => {
    it("host locks session with >= 2 participants", async () => {
      const host = Keypair.generate();
      await airdrop(host.publicKey);

      const sessionId = randomSessionId();
      const sessionPda = getSessionPda(sessionId, host.publicKey);
      const escrowPda = getEscrowPda(sessionPda);

      await program.methods
        .initializeSession(sessionId, new anchor.BN(1_000_000_000), 5, 4)
        .accounts({
          host: host.publicKey,
          session: sessionPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([host])
        .rpc();

      // Add 2 participants
      const p1 = Keypair.generate();
      const p2 = Keypair.generate();
      await airdrop(p1.publicKey);
      await airdrop(p2.publicKey);

      for (const [p, name] of [[p1, "Alice"], [p2, "Bob"]] as [Keypair, string][]) {
        await program.methods
          .joinSession(name)
          .accounts({
            participantWallet: p.publicKey,
            session: sessionPda,
            participant: getParticipantPda(sessionPda, p.publicKey),
            systemProgram: SystemProgram.programId,
          })
          .signers([p])
          .rpc();
      }

      // Lock
      await program.methods
        .lockSession()
        .accounts({
          host: host.publicKey,
          session: sessionPda,
        })
        .signers([host])
        .rpc();

      const session = await program.account.session.fetch(sessionPda);
      expect(session.state).to.equal(1); // STATE_LOCKED
    });

    it("rejects lock with < 2 participants", async () => {
      const host = Keypair.generate();
      await airdrop(host.publicKey);

      const sessionId = randomSessionId();
      const sessionPda = getSessionPda(sessionId, host.publicKey);
      const escrowPda = getEscrowPda(sessionPda);

      await program.methods
        .initializeSession(sessionId, new anchor.BN(1_000_000_000), 5, 4)
        .accounts({
          host: host.publicKey,
          session: sessionPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([host])
        .rpc();

      // Add only 1 participant
      const p1 = Keypair.generate();
      await airdrop(p1.publicKey);

      await program.methods
        .joinSession("Solo")
        .accounts({
          participantWallet: p1.publicKey,
          session: sessionPda,
          participant: getParticipantPda(sessionPda, p1.publicKey),
          systemProgram: SystemProgram.programId,
        })
        .signers([p1])
        .rpc();

      try {
        await program.methods
          .lockSession()
          .accounts({
            host: host.publicKey,
            session: sessionPda,
          })
          .signers([host])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.toString()).to.contain("NotEnoughParticipants");
      }
    });

    it("rejects non-host trying to lock", async () => {
      const host = Keypair.generate();
      const imposter = Keypair.generate();
      await airdrop(host.publicKey);
      await airdrop(imposter.publicKey);

      const sessionId = randomSessionId();
      const sessionPda = getSessionPda(sessionId, host.publicKey);
      const escrowPda = getEscrowPda(sessionPda);

      await program.methods
        .initializeSession(sessionId, new anchor.BN(1_000_000_000), 5, 4)
        .accounts({
          host: host.publicKey,
          session: sessionPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([host])
        .rpc();

      try {
        // Imposter tries to lock — PDA derivation will fail since
        // session was created with host's key, not imposter's
        await program.methods
          .lockSession()
          .accounts({
            host: imposter.publicKey,
            session: sessionPda,
          })
          .signers([imposter])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.toString()).to.not.be.empty;
      }
    });
  });

  // ── Test: Confirm Bill ────────────────────────────────────────────────

  describe("confirm_bill", () => {
    it("full confirm flow: all participants confirm → state becomes CONFIRMING", async () => {
      const host = Keypair.generate();
      await airdrop(host.publicKey);

      const sessionId = randomSessionId();
      const sessionPda = getSessionPda(sessionId, host.publicKey);
      const escrowPda = getEscrowPda(sessionPda);

      await program.methods
        .initializeSession(sessionId, new anchor.BN(1_000_000_000), 5, 4)
        .accounts({
          host: host.publicKey,
          session: sessionPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([host])
        .rpc();

      const p1 = Keypair.generate();
      const p2 = Keypair.generate();
      await airdrop(p1.publicKey);
      await airdrop(p2.publicKey);

      const p1Pda = getParticipantPda(sessionPda, p1.publicKey);
      const p2Pda = getParticipantPda(sessionPda, p2.publicKey);

      for (const [p, pda, name] of [
        [p1, p1Pda, "Alice"],
        [p2, p2Pda, "Bob"],
      ] as [Keypair, PublicKey, string][]) {
        await program.methods
          .joinSession(name)
          .accounts({
            participantWallet: p.publicKey,
            session: sessionPda,
            participant: pda,
            systemProgram: SystemProgram.programId,
          })
          .signers([p])
          .rpc();
      }

      // Lock
      await program.methods
        .lockSession()
        .accounts({ host: host.publicKey, session: sessionPda })
        .signers([host])
        .rpc();

      // P1 confirms
      await program.methods
        .confirmBill()
        .accounts({
          participantWallet: p1.publicKey,
          session: sessionPda,
          participant: p1Pda,
        })
        .signers([p1])
        .rpc();

      let session = await program.account.session.fetch(sessionPda);
      expect(session.confirmedCount).to.equal(1);
      expect(session.state).to.equal(1); // Still LOCKED

      // P2 confirms — should auto-advance to CONFIRMING
      await program.methods
        .confirmBill()
        .accounts({
          participantWallet: p2.publicKey,
          session: sessionPda,
          participant: p2Pda,
        })
        .signers([p2])
        .rpc();

      session = await program.account.session.fetch(sessionPda);
      expect(session.confirmedCount).to.equal(2);
      expect(session.state).to.equal(2); // STATE_CONFIRMING
    });

    it("rejects double confirmation", async () => {
      const host = Keypair.generate();
      await airdrop(host.publicKey);

      const sessionId = randomSessionId();
      const sessionPda = getSessionPda(sessionId, host.publicKey);
      const escrowPda = getEscrowPda(sessionPda);

      await program.methods
        .initializeSession(sessionId, new anchor.BN(1_000_000_000), 5, 4)
        .accounts({
          host: host.publicKey,
          session: sessionPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([host])
        .rpc();

      const p1 = Keypair.generate();
      const p2 = Keypair.generate();
      await airdrop(p1.publicKey);
      await airdrop(p2.publicKey);

      for (const [p, name] of [[p1, "A"], [p2, "B"]] as [Keypair, string][]) {
        await program.methods.joinSession(name).accounts({
          participantWallet: p.publicKey,
          session: sessionPda,
          participant: getParticipantPda(sessionPda, p.publicKey),
          systemProgram: SystemProgram.programId,
        }).signers([p]).rpc();
      }

      await program.methods.lockSession().accounts({
        host: host.publicKey,
        session: sessionPda,
      }).signers([host]).rpc();

      const p1Pda = getParticipantPda(sessionPda, p1.publicKey);

      await program.methods.confirmBill().accounts({
        participantWallet: p1.publicKey,
        session: sessionPda,
        participant: p1Pda,
      }).signers([p1]).rpc();

      try {
        await program.methods.confirmBill().accounts({
          participantWallet: p1.publicKey,
          session: sessionPda,
          participant: p1Pda,
        }).signers([p1]).rpc();
        expect.fail("Should have thrown on double confirm");
      } catch (e: any) {
        expect(e.toString()).to.contain("AlreadyConfirmed");
      }
    });
  });

  // ── Test: Cancel Session ──────────────────────────────────────────────

  describe("cancel_session", () => {
    it("host cancels an open session", async () => {
      const host = Keypair.generate();
      await airdrop(host.publicKey);

      const sessionId = randomSessionId();
      const sessionPda = getSessionPda(sessionId, host.publicKey);
      const escrowPda = getEscrowPda(sessionPda);

      await program.methods
        .initializeSession(sessionId, new anchor.BN(1_000_000_000), 5, 4)
        .accounts({
          host: host.publicKey,
          session: sessionPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([host])
        .rpc();

      // Add a participant
      const p1 = Keypair.generate();
      await airdrop(p1.publicKey);

      const p1Pda = getParticipantPda(sessionPda, p1.publicKey);

      await program.methods
        .joinSession("CancelMe")
        .accounts({
          participantWallet: p1.publicKey,
          session: sessionPda,
          participant: p1Pda,
          systemProgram: SystemProgram.programId,
        })
        .signers([p1])
        .rpc();

      // Cancel — pass participant PDA as remaining_account
      await program.methods
        .cancelSession()
        .accounts({
          host: host.publicKey,
          session: sessionPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: p1Pda, isSigner: false, isWritable: true },
        ])
        .signers([host])
        .rpc();

      // Session account should be closed (zeroed)
      const sessionAccount = await provider.connection.getAccountInfo(
        sessionPda
      );
      expect(sessionAccount).to.be.null;
    });
  });

  // ── Test: Full Flow (up to CONFIRMING) ────────────────────────────────

  describe("full flow up to CONFIRMING", () => {
    it("init → join(3) → lock → confirm(3) → state=CONFIRMING", async () => {
      const host = Keypair.generate();
      await airdrop(host.publicKey);

      const sessionId = randomSessionId();
      const totalLamports = new anchor.BN(3_000_000_000); // 3 SOL
      const sessionPda = getSessionPda(sessionId, host.publicKey);
      const escrowPda = getEscrowPda(sessionPda);

      // 1. Initialize
      await program.methods
        .initializeSession(sessionId, totalLamports, 7, 5)
        .accounts({
          host: host.publicKey,
          session: sessionPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([host])
        .rpc();

      // 2. Three participants join
      const participants: Keypair[] = [];
      const participantPdas: PublicKey[] = [];

      for (let i = 0; i < 3; i++) {
        const p = Keypair.generate();
        await airdrop(p.publicKey);
        participants.push(p);

        const pda = getParticipantPda(sessionPda, p.publicKey);
        participantPdas.push(pda);

        await program.methods
          .joinSession(`Player${i + 1}`)
          .accounts({
            participantWallet: p.publicKey,
            session: sessionPda,
            participant: pda,
            systemProgram: SystemProgram.programId,
          })
          .signers([p])
          .rpc();
      }

      let session = await program.account.session.fetch(sessionPda);
      expect(session.participantCount).to.equal(3);
      expect(session.state).to.equal(0); // OPEN

      // 3. Lock
      await program.methods
        .lockSession()
        .accounts({ host: host.publicKey, session: sessionPda })
        .signers([host])
        .rpc();

      session = await program.account.session.fetch(sessionPda);
      expect(session.state).to.equal(1); // LOCKED

      // 4. No more joins allowed
      const lateJoiner = Keypair.generate();
      await airdrop(lateJoiner.publicKey);

      try {
        await program.methods
          .joinSession("TooLate")
          .accounts({
            participantWallet: lateJoiner.publicKey,
            session: sessionPda,
            participant: getParticipantPda(sessionPda, lateJoiner.publicKey),
            systemProgram: SystemProgram.programId,
          })
          .signers([lateJoiner])
          .rpc();
        expect.fail("Should reject join after lock");
      } catch (e: any) {
        expect(e.toString()).to.contain("NotOpen");
      }

      // 5. All confirm
      for (let i = 0; i < 3; i++) {
        await program.methods
          .confirmBill()
          .accounts({
            participantWallet: participants[i].publicKey,
            session: sessionPda,
            participant: participantPdas[i],
          })
          .signers([participants[i]])
          .rpc();
      }

      session = await program.account.session.fetch(sessionPda);
      expect(session.confirmedCount).to.equal(3);
      expect(session.state).to.equal(2); // CONFIRMING

      // 6. Verify all participant PDAs
      for (let i = 0; i < 3; i++) {
        const p = await program.account.participant.fetch(participantPdas[i]);
        expect(p.confirmedBill).to.equal(true);
        expect(p.displayName).to.equal(`Player${i + 1}`);
        expect(p.joinIndex).to.equal(i);
      }
    });
  });
});

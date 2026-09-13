use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

declare_id!("C6BADkFFFckPvxBCzsedCGFVzF9t1ByZszkUTmWjHbzR");

#[program]
pub mod defi_vault {
    use super::*;
    pub fn initialize_vault(ctx: Context<InitializeVault>, capacity: u64) -> Result<()> {
        require!(capacity > 0, VaultError::ZeroAmount);
        require!(
            ctx.accounts.mint.freeze_authority.is_none(),
            VaultError::FreezeAuthority
        );
        let v = &mut ctx.accounts.vault;
        v.admin = ctx.accounts.admin.key();
        v.mint = ctx.accounts.mint.key();
        v.capacity = capacity;
        v.bump = ctx.bumps.vault;
        Ok(())
    }
    pub fn deposit(ctx: Context<Deposit>, amount: u64, min_shares: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        let v = &ctx.accounts.vault;
        let assets = add(v.total_assets, amount)?;
        require!(assets <= v.capacity, VaultError::Capacity);
        let shares = if v.total_shares == 0 {
            amount
        } else {
            ratio(amount, v.total_shares, v.total_assets)?
        };
        require!(shares > 0, VaultError::Dust);
        require!(shares >= min_shares, VaultError::Slippage);
        let total_shares = add(v.total_shares, shares)?;
        let position_shares = add(ctx.accounts.position.shares, shares)?;
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.user_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault_token.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        let v = &mut ctx.accounts.vault;
        v.total_assets = assets;
        v.total_shares = total_shares;
        let p = &mut ctx.accounts.position;
        p.owner = ctx.accounts.user.key();
        p.vault = v.key();
        p.shares = position_shares;
        Ok(())
    }
    pub fn withdraw(ctx: Context<Withdraw>, shares: u64, min_amount: u64) -> Result<()> {
        require!(shares > 0, VaultError::ZeroAmount);
        require!(
            shares <= ctx.accounts.position.shares,
            VaultError::InsufficientShares
        );
        let v = &ctx.accounts.vault;
        let amount = ratio(shares, v.total_assets, v.total_shares)?;
        require!(amount > 0, VaultError::Dust);
        require!(amount >= min_amount, VaultError::Slippage);
        let seeds: &[&[u8]] = &[b"vault", v.admin.as_ref(), v.mint.as_ref(), &[v.bump]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: v.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        let v = &mut ctx.accounts.vault;
        v.total_assets = sub(v.total_assets, amount)?;
        v.total_shares = sub(v.total_shares, shares)?;
        ctx.accounts.position.shares = sub(ctx.accounts.position.shares, shares)?;
        Ok(())
    }
    pub fn add_yield(ctx: Context<AddYield>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        require!(ctx.accounts.vault.total_shares > 0, VaultError::EmptyVault);
        let assets = add(ctx.accounts.vault.total_assets, amount)?;
        require!(assets <= ctx.accounts.vault.capacity, VaultError::Capacity);
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.admin_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault_token.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        ctx.accounts.vault.total_assets = assets;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(init, payer = admin, space = 8 + Vault::INIT_SPACE, seeds = [b"vault", admin.key().as_ref(), mint.key().as_ref()], bump)]
    pub vault: Account<'info, Vault>,
    #[account(init, payer = admin, seeds = [b"tokens", vault.key().as_ref()], bump, token::mint = mint, token::authority = vault)]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"vault", vault.admin.as_ref(), mint.key().as_ref()], bump = vault.bump, has_one = mint)]
    pub vault: Account<'info, Vault>,
    #[account(init_if_needed, payer = user, space = 8 + UserPosition::INIT_SPACE, seeds = [b"position", vault.key().as_ref(), user.key().as_ref()], bump)]
    pub position: Account<'info, UserPosition>,
    #[account(mut, token::mint = mint, token::authority = user)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"tokens", vault.key().as_ref()], bump, token::mint = mint, token::authority = vault)]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub user: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"vault", vault.admin.as_ref(), mint.key().as_ref()], bump = vault.bump, has_one = mint)]
    pub vault: Account<'info, Vault>,
    #[account(mut, seeds = [b"position", vault.key().as_ref(), user.key().as_ref()], bump, has_one = vault, constraint = position.owner == user.key())]
    pub position: Account<'info, UserPosition>,
    #[account(mut, token::mint = mint, token::authority = user)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"tokens", vault.key().as_ref()], bump, token::mint = mint, token::authority = vault)]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddYield<'info> {
    pub admin: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"vault", admin.key().as_ref(), mint.key().as_ref()], bump = vault.bump, has_one = mint, has_one = admin)]
    pub vault: Account<'info, Vault>,
    #[account(mut, token::mint = mint, token::authority = admin)]
    pub admin_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"tokens", vault.key().as_ref()], bump, token::mint = mint, token::authority = vault)]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub total_assets: u64,
    pub total_shares: u64,
    pub capacity: u64,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct UserPosition {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub shares: u64,
}
fn add(a: u64, b: u64) -> Result<u64> {
    a.checked_add(b)
        .ok_or_else(|| error!(VaultError::Arithmetic))
}
fn sub(a: u64, b: u64) -> Result<u64> {
    a.checked_sub(b)
        .ok_or_else(|| error!(VaultError::Arithmetic))
}
fn ratio(a: u64, b: u64, d: u64) -> Result<u64> {
    let n = (a as u128)
        .checked_mul(b as u128)
        .and_then(|n| n.checked_div(d as u128))
        .ok_or(VaultError::Arithmetic)?;
    u64::try_from(n).map_err(|_| error!(VaultError::Arithmetic))
}
#[error_code]
pub enum VaultError {
    #[msg("Amount must be positive")]
    ZeroAmount,
    #[msg("Arithmetic overflow, underflow or division by zero")]
    Arithmetic,
    #[msg("Vault capacity exceeded")]
    Capacity,
    #[msg("Amount rounds to zero")]
    Dust,
    #[msg("Minimum output not met")]
    Slippage,
    #[msg("Not enough shares")]
    InsufficientShares,
    #[msg("Cannot fund yield without depositors")]
    EmptyVault,
    #[msg("Mint must have no freeze authority")]
    FreezeAuthority,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deposit_after_yield() {
        assert_eq!(ratio(100, 100, 110).unwrap(), 90);
    }
    #[test]
    fn withdraw_yield() {
        assert_eq!(ratio(100, 110, 100).unwrap(), 110);
    }
    #[test]
    fn partial_withdraw() {
        assert_eq!(ratio(25, 110, 100).unwrap(), 27);
    }
    #[test]
    fn dust_rounds_down() {
        assert_eq!(ratio(1, 1, 100).unwrap(), 0);
    }
    #[test]
    fn division_zero_rejected() {
        assert!(ratio(1, 1, 0).is_err());
    }
    #[test]
    fn addition_overflow_rejected() {
        assert!(add(u64::MAX, 1).is_err());
    }
    #[test]
    fn subtraction_underflow_rejected() {
        assert!(sub(0, 1).is_err());
    }
    #[test]
    fn intermediate_u128() {
        assert_eq!(ratio(u64::MAX, u64::MAX, u64::MAX).unwrap(), u64::MAX);
    }
    #[test]
    fn result_overflow_rejected() {
        assert!(ratio(u64::MAX, 2, 1).is_err());
    }
}

<script lang="ts">
	import { ShoppingCart, Plus, Minus, Trash2, X } from 'lucide-svelte';
	import { Button, Badge } from '@parallaxrealms/pxp-components';
	import { cart, cartPopoverOpen } from '@parallaxrealms/pxp-utils/stores-ecom';
	import type { CartItem } from '@parallaxrealms/pxp-types/ecom';
	import { goto } from '$app/navigation';

	let { class: className = '' } = $props<{
		class?: string;
	}>();

	let cartItems = $state<CartItem[]>([]);
	let isOpen = $state(false);

	// Subscribe to cart store
	$effect(() => {
		const unsubscribe = cart.subscribe((items) => {
			cartItems = items;
		});
		return unsubscribe;
	});

	// Subscribe to cart popover state
	$effect(() => {
		const unsubscribe = cartPopoverOpen.subscribe((open) => {
			isOpen = open;
		});
		return unsubscribe;
	});

	// Calculate totals
	let cartTotal = $derived(
		cartItems.reduce((total, item) => total + item.price * item.quantity, 0)
	);

	let itemCount = $derived(cartItems.reduce((count, item) => count + item.quantity, 0));

	function updateQuantity(item: CartItem, newQuantity: number) {
		cart.updateQuantity(item.productId, newQuantity, item.color, item.size, item.customization);
	}

	function removeItem(item: CartItem) {
		cart.removeFromCart(item.productId, item.color, item.size, item.customization);
	}

	function proceedToCheckout() {
		cartPopoverOpen.set(false);
		goto('/cart');
	}

	function viewFullCart() {
		cartPopoverOpen.set(false);
		goto('/cart');
	}

	function toggleCart() {
		cartPopoverOpen.update((open) => !open);
	}

	function closeCart() {
		cartPopoverOpen.set(false);
	}

	// Handle keyboard navigation for cart overlay
	function handleOverlayKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeCart();
		}
	}

	function handleCartKeydown(event: KeyboardEvent) {
		// Prevent event from bubbling to overlay
		event.stopPropagation();
	}
</script>

<!-- Cart Toggle Button -->
<button
	type="button"
	class={`cart-toggle-btn inline-flex items-center gap-1 rounded-full border border-input p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground ${className}`}
	onclick={toggleCart}
	aria-label="Open shopping cart"
>
	<ShoppingCart class="h-6 w-6" strokeWidth={1.5} />
	{#if itemCount > 0}
		<span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
			{itemCount > 99 ? '99+' : itemCount}
		</span>
	{/if}
</button>

<!-- Cart Sidebar Overlay -->
{#if isOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="cart-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="cart-title"
		tabindex="-1"
		onclick={closeCart}
		onkeydown={handleOverlayKeydown}
	>
		<div
			class="cart-sidebar"
			role="document"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={handleCartKeydown}
		>
			<!-- Cart Header -->
			<div class="cart-header">
				<h2 id="cart-title" class="cart-title">
					Cart ({itemCount})
				</h2>
				<Button
					variant="ghost"
					size="icon"
					onclick={closeCart}
					aria-label="Close cart"
					class="close-btn"
				>
					<X class="h-4 w-4" />
				</Button>
			</div>

			<!-- Cart Content -->
			<div class="cart-content">
				{#if cartItems.length === 0}
					<div class="empty-cart">
						<div class="text-center">
							<ShoppingCart class="empty-cart-icon" />
							<h3 class="empty-cart-title">Your cart is empty</h3>
							<p class="empty-cart-subtitle">Add some items to get started!</p>
							<Button
								variant="default"
								size="lg"
								class="continue-shopping-btn px-4"
								onclick={closeCart}
							>
								Continue Shopping
							</Button>
						</div>
					</div>
				{:else}
					<!-- Cart Items -->
					<div class="cart-items-container">
						<div class="cart-items-list">
							{#each cartItems as item (item.productId + item.color + item.size + (item.customization || ''))}
								<div class="cart-item">
									<!-- Item Image -->
									<div class="item-image-container">
										<img
											src={item.imageUrl || '/placeholder-product.jpg'}
											alt={item.title}
											class="item-image"
										/>
									</div>

									<!-- Item Details -->
									<div class="item-details">
										<h4 class="item-title">{item.title}</h4>

										<!-- Variations -->
										{#if item.color !== 'none' || item.size !== 'none'}
											<div class="item-variations">
												{#if item.color !== 'none'}
													<Badge variant="default" size="sm" class="variation-badge">
														{item.color}
													</Badge>
												{/if}
												{#if item.size !== 'none'}
													<Badge variant="default" size="sm" class="variation-badge">
														{item.size}
													</Badge>
												{/if}
											</div>
										{/if}

										{#if item.customization}
											<div class="item-customization flex flex-col gap-1">
												<!-- Color -->
												{#if item.customization.colorName}
													<Badge variant="default" size="sm" class="variation-badge">
														Color: {item.customization.colorName}
													</Badge>
												{/if}

												<!-- Front/Back Design Thumbnails -->
												{#if item.customization.frontDesign}
													<div class="flex items-center gap-1">
														<Badge variant="outlined" size="sm" class="custom-badge">Front</Badge>
														<img
															src={item.customization.frontDesign.imageUrl}
															alt="Front Design"
															class="h-6 w-6 rounded border border-slate-600 object-contain"
														/>
													</div>
												{/if}

												{#if item.customization.backDesign}
													<div class="flex items-center gap-1">
														<Badge variant="outlined" size="sm" class="custom-badge">Back</Badge>
														<img
															src={item.customization.backDesign.imageUrl}
															alt="Back Design"
															class="h-6 w-6 rounded border border-slate-600 object-contain"
														/>
													</div>
												{/if}

												<!-- Mockup Previews -->
												<div class="flex gap-1">
													{#if item.customization.frontImage}
														<img
															src={`https://www.ssactivewear.com/${item.customization.frontImage}`}
															alt="Front Mockup"
															class="h-6 w-6 rounded border border-slate-600 object-contain"
														/>
													{/if}
													{#if item.customization.backImage}
														<img
															src={`https://www.ssactivewear.com/${item.customization.backImage}`}
															alt="Back Mockup"
															class="h-6 w-6 rounded border border-slate-600 object-contain"
														/>
													{/if}
												</div>
											</div>
										{/if}

										<!-- Price and Controls -->
										<div class="item-controls">
											<p class="item-price">
												${(item.price / 100).toFixed(2)}
											</p>

											<!-- Quantity Controls -->
											<div class="quantity-controls">
												<Button
													variant="ghost"
													size="icon"
													class="quantity-btn"
													onclick={() => updateQuantity(item, item.quantity - 1)}
													aria-label="Decrease quantity"
												>
													<Minus class="h-3 w-3" />
												</Button>

												<span class="quantity-display">
													{item.quantity}
												</span>

												<Button
													variant="ghost"
													size="icon"
													class="quantity-btn"
													onclick={() => updateQuantity(item, item.quantity + 1)}
													aria-label="Increase quantity"
												>
													<Plus class="h-3 w-3" />
												</Button>

												<Button
													variant="ghost"
													size="icon"
													class="remove-btn"
													onclick={() => removeItem(item)}
													aria-label="Remove item from cart"
												>
													<Trash2 class="h-3 w-3" />
												</Button>
											</div>
										</div>
									</div>

									<!-- Item Total -->
									<div class="item-total">
										<p class="total-price">
											${((item.price * item.quantity) / 100).toFixed(2)}
										</p>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Cart Footer -->
					<div class="cart-footer">
						<div class="subtotal-section">
							<span class="subtotal-label">Subtotal:</span>
							<span class="subtotal-amount">${(cartTotal / 100).toFixed(2)}</span>
						</div>

						<p class="shipping-notice">Shipping & taxes calculated at checkout</p>

						<div class="footer-actions">
							<Button
								variant="default"
								class="add-to-cart-btn w-full border-slate-400 bg-slate-700 hover:border-cyan-400 hover:bg-cyan-600"
								onclick={viewFullCart}
							>
								View Cart & Checkout
							</Button>

							<Button
								variant="outlined"
								class="add-to-cart-btn w-full border-slate-400 hover:border-cyan-400 hover:bg-cyan-600"
								onclick={closeCart}
							>
								Continue Shopping
							</Button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Cart Toggle Button */
	.cart-toggle-btn {
		transition: all 150ms;
	}

	/* Cart Overlay */
	.cart-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background-color: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(4px);
	}

	.cart-sidebar {
		position: absolute;
		right: 0;
		top: 0;
		display: flex;
		height: 100%;
		width: 100%;
		max-width: 24rem;
		flex-direction: column;
		background-color: #030619;
		border-left: 1px solid var(--color-border);
		box-shadow: var(--shadow-xl);
	}

	/* Cart Header */
	.cart-header {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--color-border);
		padding: 0.75rem;
		background-color: var(--color-surface);
	}

	.cart-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
	}

	:global(.close-btn) {
		color: var(--color-text-muted) !important;
	}

	:global(.close-btn:hover) {
		color: var(--color-text) !important;
	}

	/* Cart Content */
	.cart-content {
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
	}

	/* Empty Cart */
	.empty-cart {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.empty-cart-title {
		margin-bottom: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.empty-cart-subtitle {
		margin-bottom: 0.75rem;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	:global(.continue-shopping-btn) {
		font-size: 0.875rem;
	}

	/* Cart Items */
	.cart-items-container {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem;
	}

	.cart-items-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.cart-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		border-radius: var(--border-radius-lg);
		background-color: var(--color-surface-hover);
		padding: 0.5rem;
		transition: all var(--transition-fast);
	}

	.cart-item:hover {
		background-color: var(--color-surface);
		box-shadow: var(--shadow-sm);
	}

	/* Item Image */
	.item-image-container {
		flex-shrink: 0;
	}

	.item-image {
		height: 3rem;
		width: 3rem;
		border-radius: var(--border-radius-md);
		object-fit: cover;
	}

	/* Item Details */
	.item-details {
		min-width: 0;
		flex: 1;
	}

	.item-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-variations {
		margin-top: 0.25rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	:global(.variation-badge) {
		font-size: 0.75rem !important;
		padding: 0.125rem 0.375rem !important;
	}

	.item-customization {
		margin-top: 0.25rem;
	}

	:global(.custom-badge) {
		background-color: var(--color-accent) !important;
		color: white !important;
		border: none !important;
		font-size: 0.75rem !important;
		padding: 0.125rem 0.375rem !important;
	}

	.item-controls {
		margin-top: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.item-price {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-primary);
	}

	/* Quantity Controls */
	.quantity-controls {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	:global(.quantity-btn) {
		height: 1.5rem !important;
		width: 1.5rem !important;
		color: var(--color-text-muted) !important;
	}

	:global(.quantity-btn:hover) {
		color: var(--color-text) !important;
	}

	.quantity-display {
		min-width: 1.5rem;
		text-align: center;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text);
	}

	:global(.remove-btn) {
		color: var(--color-error) !important;
	}

	:global(.remove-btn:hover) {
		color: var(--color-error) !important;
		opacity: 0.8;
	}

	/* Item Total */
	.item-total {
		flex-shrink: 0;
		text-align: right;
	}

	.total-price {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text);
	}

	/* Cart Footer */
	.cart-footer {
		flex-shrink: 0;
		border-top: 1px solid var(--color-border);
		background-color: var(--color-surface);
		padding: 0.75rem;
	}

	.subtotal-section {
		margin-bottom: 0.75rem;
		display: flex;
		justify-content: space-between;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.shipping-notice {
		margin-bottom: 0.75rem;
		text-align: center;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.footer-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	:global(.checkout-btn) {
		background: linear-gradient(135deg, var(--color-primary), var(--color-accent)) !important;
		padding: 0.5rem !important;
		font-size: 0.875rem !important;
		font-weight: 600;
		transition: all var(--transition-fast);
	}

	:global(.checkout-btn:hover) {
		box-shadow: var(--shadow-lg);
		transform: translateY(-1px);
	}

	:global(.continue-btn) {
		padding: 0.375rem !important;
		font-size: 0.875rem !important;
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.cart-sidebar {
			max-width: 100%;
		}
	}
</style>

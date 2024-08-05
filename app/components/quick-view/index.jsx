import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    Box,
    Text,
    AspectRatio,
    Stack,
    Flex,
    Button,
    Fade,
    Skeleton
} from '@salesforce/retail-react-app/app/components/shared/ui'
import DynamicImage from '@salesforce/retail-react-app/app/components/dynamic-image'
import { useIntl } from 'react-intl'
import useEinstein from '@salesforce/retail-react-app/app/hooks/use-einstein'
import QuantityPicker from '@salesforce/retail-react-app/app/components/quantity-picker'
import ItemVariantProvider from '@salesforce/retail-react-app/app/components/item-variant'
import CartItemVariantAttributes from '@salesforce/retail-react-app/app/components/item-variant/item-attributes'
import { useCurrentBasket } from '../../hooks/use-current-basket'
import { useServerContext } from '@salesforce/pwa-kit-react-sdk/ssr/universal/hooks'
import {
    MAX_CACHE_AGE,
    TOAST_ACTION_VIEW_WISHLIST,
    TOAST_MESSAGE_ADDED_TO_WISHLIST,
    TOAST_MESSAGE_ALREADY_IN_WISHLIST
} from '@salesforce/retail-react-app/app/constants'
import withRegistration from '@salesforce/retail-react-app/app/components/with-registration'
import { useWishList } from '@salesforce/retail-react-app/app/hooks/use-wish-list'
import { useToast } from '@salesforce/retail-react-app/app/hooks/use-toast'
import {
    useShopperBasketsMutation,
    useShopperCustomersMutation,
    useCustomerId
} from '@salesforce/commerce-sdk-react'
import LoadingSpinner from '@salesforce/retail-react-app/app/components/loading-spinner'
import { FormattedMessage } from 'react-intl'

const QuickView = ({ isOpen, onClose, product }) => {
    const intl = useIntl()
    const { image, price, productId, productName, currency } = product
    const [quantity, setQuantity] = useState(1)
    const [showLoading, setShowLoading] = useState(false)
    const [showInventoryMessage, setShowInventoryMessage] = useState(false)
    const inventoryMessage = "Limited stock available!"
    const einstein = useEinstein()
    const { formatMessage } = useIntl()
    const customerId = useCustomerId()
    const toast = useToast()
    const ButtonWithRegistration = withRegistration(Button)

    const { data: wishlist, isLoading: isWishlistLoading } = useWishList()
    const createCustomerProductListItem = useShopperCustomersMutation('createCustomerProductListItem')

    const { data: basket } = useCurrentBasket()
    const addItemToBasketMutation = useShopperBasketsMutation('addItemToBasket')
    const { res } = useServerContext()
    if (res) {
        res.set('Cache-Control', `s-maxage=${MAX_CACHE_AGE}`)
    }

    const handleAddToCart = async () => {
        try {
            let itemList = []
            const productItems = {
                productId: product.representedProduct.id,
                price: product.price,
                quantity: quantity
            }

            itemList.push(productItems);

            await addItemToBasketMutation.mutateAsync({
                parameters: { basketId: basket.basketId },
                body: itemList
            })

            einstein.sendAddToCart(productItems)

            // If the items were successfully added, set the return value to be used
            // by the add to cart modal.
            return productSelectionValues
        } catch (error) {
            showError(error)
        }
    }

    const handleAddToWishlist = (product, quantity) => {
        const isItemInWishlist = wishlist?.customerProductListItems?.find(
            (i) => i.productId === product.representedProduct.id
        )

        if (!isItemInWishlist) {
            createCustomerProductListItem.mutate(
                {
                    parameters: {
                        listId: wishlist.id,
                        customerId
                    },
                    body: {
                        // NOTE: APi does not respect quantity, it always adds 1
                        quantity,
                        productId: product.representedProduct.id || null,
                        public: false,
                        priority: 1,
                        type: 'product'
                    }
                },
                {
                    onSuccess: () => {
                        toast({
                            title: formatMessage(TOAST_MESSAGE_ADDED_TO_WISHLIST, { quantity: 1 }),
                            status: 'success',
                            action: (
                                // it would be better if we could use <Button as={Link}>
                                // but unfortunately the Link component is not compatible
                                // with Chakra Toast, since the ToastManager is rendered via portal
                                // and the toast doesn't have access to intl provider, which is a
                                // requirement of the Link component.
                                <Button
                                    variant="link"
                                    onClick={() => navigate('/account/wishlist')}
                                >
                                    {formatMessage(TOAST_ACTION_VIEW_WISHLIST)}
                                </Button>
                            )
                        })
                    },
                    onError: () => {
                        showError()
                    }
                }
            )
        } else {
            toast({
                title: formatMessage(TOAST_MESSAGE_ALREADY_IN_WISHLIST),
                status: 'info',
                action: (
                    <Button variant="link" onClick={() => navigate('/account/wishlist')}>
                        {formatMessage(TOAST_ACTION_VIEW_WISHLIST)}
                    </Button>
                )
            })
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>{productName}</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <ItemVariantProvider variant={product}>
                        {showLoading && <LoadingSpinner />}
                        <Flex direction={{ base: 'column', md: 'row' }} alignItems="flex-start">
                            <AspectRatio ratio={1} width={['100%', '50%']} mr={4}>
                                <DynamicImage
                                    src={`${image.disBaseLink || image.link}[?sw={width}&q=60]`}
                                    imageProps={{
                                        alt: image.alt
                                    }}
                                />
                            </AspectRatio>
                            <Stack spacing={4} flex={1}>
                                <Text fontWeight="bold" color="black.600">
                                    {productName}
                                </Text>
                                <CartItemVariantAttributes />
                                <Text fontSize="xl" fontWeight="bold">
                                    {intl.formatNumber(price, {
                                        style: 'currency',
                                        currency: currency
                                    })}
                                </Text>
                                <Flex alignItems="center">
                                    <Text fontSize="sm" color="gray.700">
                                        <FormattedMessage
                                            defaultMessage="Quantity:"
                                            id="product_item.label.quantity"
                                        />
                                    </Text>

                                    <QuantityPicker
                                        step={1}
                                        value={quantity}
                                        min={0}
                                        onChange={(stringValue, numberValue) => {
                                            if (numberValue >= 0) {
                                                setQuantity(numberValue)
                                            }
                                        }}
                                    />
                                </Flex>
                                <Flex alignItems="stretch" justifyContent="space-between">
                                    <Button
                                        onClick={handleAddToCart}
                                        flex="1"
                                        mr={2}
                                        bg="blue.500"
                                        color="white"
                                        _hover={{ bg: "blue.600" }}
                                        _active={{ bg: "blue.700" }}
                                    >
                                        Add to Cart
                                    </Button>
                                    <ButtonWithRegistration
                                        onClick={() => handleAddToWishlist(product, quantity)}
                                        flex="1"
                                        variant="outline"
                                        borderColor="blue.500"
                                        color="blue.500"
                                        _hover={{ bg: "blue.50" }}
                                        _active={{ bg: "blue.100" }}
                                    >
                                        Add to Wishlist
                                    </ButtonWithRegistration>
                                </Flex>
                                {product && showInventoryMessage && (
                                    <Fade in={true}>
                                        <Text color="orange.600" fontWeight={600}>
                                            {inventoryMessage}
                                        </Text>
                                    </Fade>
                                )}
                            </Stack>
                        </Flex>
                    </ItemVariantProvider>
                </ModalBody>
            </ModalContent>
        </Modal>
    )
}

QuickView.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    product: PropTypes.shape({
        image: PropTypes.shape({
            alt: PropTypes.string,
            disBaseLink: PropTypes.string,
            link: PropTypes.string
        }),
        price: PropTypes.number,
        productId: PropTypes.string,
        productName: PropTypes.string,
        currency: PropTypes.string
    }).isRequired,
    onFavouriteToggle: PropTypes.func.isRequired,
    isFavourite: PropTypes.bool.isRequired
}

export default QuickView

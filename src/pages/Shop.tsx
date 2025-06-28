import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Card, CardBody, CardFooter, Chip, Spinner } from '@heroui/react';
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiShoppingCartLine } from 'react-icons/ri';
import { queryDocs, deleteDocById } from '../firebase/firestore';
import { where } from 'firebase/firestore';
import type { Product } from '../firebase/models';
import { toast } from 'react-toastify';

export default function Shop() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isFacilityManager = userData?.role === 'facility_manager';

  useEffect(() => {
    fetchProducts();
  }, [userData]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let fetchedProducts: Product[] = [];

      if (isFacilityManager && userData?.uid) {
        // Facility managers see only their products
        fetchedProducts = await queryDocs<Product>(
          'products',
          [where('facilityId', '==', userData.uid)],
          100
        );
      } else {
        // Players see all products
        fetchedProducts = await queryDocs<Product>('products', [], 100);
      }

      setProducts(fetchedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    navigate('/dashboard/shop/add');
  };

  const handleEditProduct = (productId: string) => {
    navigate(`/dashboard/shop/edit/${productId}`);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      setDeleting(productId);
      await deleteDocById('products', productId);
      setProducts(products.filter(p => p.id !== productId));
      toast.success('Product deleted successfully');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    } finally {
      setDeleting(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isFacilityManager ? 'Manage Products' : 'Shop'}
          </h1>
          <p className="text-gray-600">
            {isFacilityManager 
              ? 'Manage your facility\'s products and inventory'
              : 'Browse and purchase pickleball equipment'
            }
          </p>
        </div>
        
        {isFacilityManager && (
          <Button
            color="primary"
            startContent={<RiAddLine className="text-lg" />}
            onClick={handleAddProduct}
            className="bg-court-green hover:bg-court-green/90"
          >
            Add Product
          </Button>
        )}
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="glass-card p-12">
          <div className="text-center">
            <RiShoppingCartLine className="text-6xl text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-700 mb-2">
              {isFacilityManager ? 'No Products Added' : 'No Products Available'}
            </h2>
            <p className="text-gray-600 mb-6">
              {isFacilityManager 
                ? 'Start by adding your first product to the shop.'
                : 'Check back later for available products.'
              }
            </p>
            {isFacilityManager && (
              <Button
                color="primary"
                startContent={<RiAddLine className="text-lg" />}
                onClick={handleAddProduct}
                className="bg-court-green hover:bg-court-green/90"
              >
                Add Your First Product
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="glass-card hover:shadow-lg transition-shadow">
              <CardBody className="p-0">
                {/* Product Image */}
                <div className="aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
                  {product.mediaUrls && Array.isArray(product.mediaUrls) && product.mediaUrls.length > 0 && product.mediaUrls[0] ? (
                    <img
                      src={product.mediaUrls[0]}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center bg-gray-200">
                            <svg class="text-4xl text-gray-400 w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z"/>
                            </svg>
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <RiShoppingCartLine className="text-4xl text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-800 line-clamp-2">
                      {product.title}
                    </h3>
                    <Chip
                      size="sm"
                      variant="flat"
                      color="primary"
                      className="ml-2 flex-shrink-0"
                    >
                      {product.category}
                    </Chip>
                  </div>
                  
                  <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                    {product.description}
                  </p>

                  <div className="flex justify-between items-center mb-2">
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-court-green">
                        {formatPrice(product.price)}
                      </span>
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <span className="text-sm text-gray-500 line-through">
                          {formatPrice(product.compareAtPrice)}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-600">
                      Qty: {product.quantity}
                    </span>
                  </div>

                  {isFacilityManager && (
                    <div className="text-xs text-gray-500 mb-3">
                      {product.weight && `Weight: ${product.weight}oz`}
                      {product.variantId && ' • Has Variants'}
                    </div>
                  )}
                </div>
              </CardBody>

              <CardFooter className="pt-0 px-4 pb-4">
                {isFacilityManager ? (
                  <div className="flex gap-2 w-full">
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      startContent={<RiEditLine />}
                      onClick={() => handleEditProduct(product.id)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      startContent={<RiDeleteBinLine />}
                      onClick={() => handleDeleteProduct(product.id)}
                      isLoading={deleting === product.id}
                      className="flex-1"
                    >
                      Delete
                    </Button>
                  </div>
                ) : (
                  <Button
                    color="primary"
                    className="w-full bg-court-green hover:bg-court-green/90"
                    startContent={<RiShoppingCartLine />}
                    isDisabled={product.quantity === 0}
                  >
                    {product.quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
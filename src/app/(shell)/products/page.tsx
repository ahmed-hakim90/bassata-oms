import { ProductsPage } from "@/modules/products/components/products-page";
import { getProductsPageDataAction } from "@/modules/products/actions/product.actions";

export default async function ProductsRoutePage() {
  const data = await getProductsPageDataAction();

  return (
    <ProductsPage
      initialProducts={data.products}
      categories={data.categories}
      currency={data.organization.currency}
      recipesEnabled={data.recipesEnabled}
      productTemplates={data.productTemplates}
      businessActivitySettings={data.businessActivitySettings}
    />
  );
}

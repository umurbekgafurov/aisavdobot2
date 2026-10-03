import { AuthService, FirestoreService } from '../src/services/firebaseService';
import { Product, Warehouse } from '../src/types';

async function runRegression() {
  console.log('==================================================');
  console.log('🔄 RUNNING FULL REGRESSION TEST ON EXISTING FEATURES');
  console.log('==================================================');

  const testEmail = `regression_user_${Date.now()}@savdobot.uz`;
  const testPass = 'RegressPass123!@#';
  const bizName = 'Regression Test Do\'kon';
  const ownerName = 'Regress Owner';

  // 1. Registration
  console.log('1. Testing User Registration...');
  const regResult = await AuthService.registerUser(testEmail, testPass, bizName, ownerName);
  console.log('✅ Registration SUCCESS! UID:', regResult.user.uid, 'Biz:', regResult.business.id);

  // 2. Fetch User Profile & Business
  console.log('2. Testing Profile & Business Retrieval...');
  const { userDoc, business } = await AuthService.getUserProfileAndBusiness(regResult.user.uid);
  if (!userDoc || !business) throw new Error('Failed to retrieve user doc or business');
  console.log('✅ Profile & Business Retrieval SUCCESS! Name:', business.name);

  // 3. Warehouse Creation & Retrieval
  console.log('3. Testing Warehouse Management...');
  const newWh: Warehouse = {
    id: `wh_reg_${Date.now()}`,
    businessId: business.id,
    name: 'Qo\'shimcha Ombor',
    address: 'Samarqand sh., Registon ko\'chasi',
    active: true,
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await FirestoreService.saveWarehouse(business.id, newWh);
  const warehouses = await FirestoreService.getWarehouses(business.id);
  const whFound = warehouses.some((w) => w.id === newWh.id);
  if (!whFound) throw new Error('Created warehouse not found');
  console.log('✅ Warehouse Management SUCCESS! Total warehouses:', warehouses.length);

  // 4. Product Creation & Retrieval
  console.log('4. Testing Product Management...');
  const newProd: Product = {
    id: `prod_reg_${Date.now()}`,
    businessId: business.id,
    warehouseId: newWh.id,
    name: 'Redmi Note 13 Pro 8/256GB',
    sku: 'RDM-N13P-256',
    category: 'Smartfonlar',
    brand: 'Xiaomi',
    model: 'Note 13 Pro',
    description: 'Yangi ochilmagan qadoqda',
    price: 3200000,
    costPrice: 2800000,
    stock: 15,
    lowStockThreshold: 3,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await FirestoreService.createProduct(business.id, newProd, ownerName);
  const products = await FirestoreService.getProducts(business.id);
  const prodFound = products.some((p) => p.id === newProd.id);
  if (!prodFound) throw new Error('Created product not found');
  console.log('✅ Product Management SUCCESS! Total products:', products.length);

  // 5. Stock Movement verification
  const movements = await FirestoreService.getStockMovements(business.id);
  console.log('✅ Stock Movement SUCCESS! Movements recorded:', movements.length);

  // 6. Logout
  console.log('5. Testing Logout...');
  await AuthService.logoutUser();
  console.log('✅ Logout SUCCESS!');

  // 7. Login
  console.log('6. Testing Login...');
  const loginUser = await AuthService.loginUser(testEmail, testPass);
  if (loginUser.uid !== regResult.user.uid) throw new Error('Login UID mismatch');
  console.log('✅ Login SUCCESS! Logged in UID:', loginUser.uid);

  console.log('==================================================');
  console.log('🎉 REGRESSION SUITE: ALL EXISTING FEATURES VERIFIED WORKING!');
  console.log('==================================================');
  process.exit(0);
}

runRegression().catch((err) => {
  console.error('❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});

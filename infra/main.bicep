@description('Static Web Apps リソース名 (グローバルで一意である必要はありませんが、リソースグループ内で一意にしてください)')
param staticWebAppName string = 'swa-scm-core-handson'

@description('Static Web Apps をデプロイするリージョン。Static Web Apps が提供されているリージョンを指定してください。')
@allowed([
  'eastasia'
  'eastus2'
  'westus2'
  'centralus'
  'westeurope'
  'northeurope'
])
param location string = 'eastasia'

@description('SKU。ハンズオンでは Free で十分です。')
@allowed([
  'Free'
  'Standard'
])
param skuName string = 'Free'

@description('リソースに付与するタグ')
param tags object = {
  project: 'screen-automation-handson'
}

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuName
  }
  properties: {
    // GitHub 連携は行わず、SWA CLI からの手動デプロイを前提とします。
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

@description('デプロイ後に公開される既定のエンドポイント')
output defaultHostname string = 'https://${staticWebApp.properties.defaultHostname}'

@description('Static Web Apps のリソース名')
output staticWebAppName string = staticWebApp.name

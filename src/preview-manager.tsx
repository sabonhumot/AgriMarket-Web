import React from 'react'
import { createRoot } from 'react-dom/client'
import EventManagerOverview from './event-manager/EventManagerOverview'
import EventManagerNotifications from './event-manager/EventManagerNotifications'
import EventManagerFarmers from './event-manager/EventManagerFarmers'
import EventManagerProfile from './event-manager/EventManagerProfile'
import './index.css'

const page = new URLSearchParams(location.search).get('page')
const content = page === 'notifications'
  ? <EventManagerNotifications initialData={[{id:1,type:'event',title:'Farmer application received',body:'A farmer applied to join your upcoming market event.',referenceId:3,referenceType:'event',isRead:false,createdAt:new Date().toISOString()}]} />
  : page === 'farmers'
  ? <EventManagerFarmers initialData={[{id:'1',name:'Ana Rivera',farmName:'Rivera Family Farm',barangay:'Poblacion',municipality:'Cebu City',verified:true,activeListings:4,totalTransactions:12}]} />
  : page === 'profile'
  ? <EventManagerProfile initialData={{organizationName:'Cebu City Market Office',organizationType:'lgu',logoPath:null,contactName:'Ana Rivera',officialEmail:'marketoffice@cebu.gov.ph',officePhone:'+63 32 123 4567',municipalityKey:'cebu-city',street:'City Hall Annex, Market Road',barangay:'Poblacion',city:'Cebu City',zipCode:'6000',accountName:'Market Coordinator',accountEmail:'coordinator@example.org'}} />
  : <EventManagerOverview initialData={{organizationName:'Cebu City Market Office',activeCount:2,expectedFarmers:18,completedCount:7,pendingApplications:3,events:[{id:'3',name:'Cebu Farmers Market',date:'2026-11-12',endDate:null,time:'8:00 AM',location:'City Plaza',status:'published',approvedFarmers:12,farmerCount:20,pendingApplications:3}]}} />

createRoot(document.getElementById('root')!).render(<React.StrictMode>{content}</React.StrictMode>)

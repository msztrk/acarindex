export type UiMessages = {
  nav: {
    journals: string
    articles: string
    authors: string
    statistics: string
    mainMenu: string
    openMenu: string
    menu: string
    mobileMenu: string
  }
  auth: {
    login: string
    loginFull: string
    register: string
    logout: string
    loggingOut: string
    forgotPassword: string
    myAccount: string
    saved: string
    lists: string
    profile: string
    accountMenu: string
    userMenu: string
    loadingSession: string
  }
  footer: {
    tagline: string
    explore: string
    platform: string
    account: string
    applications: string
    corporate: string
    about: string
    contact: string
    privacy: string
    terms: string
    rights: string
  }
  account: {
    title: string
    navLabel: string
    overview: string
    savedArticles: string
    readingLists: string
    followedJournals: string
    followedAuthors: string
    recentViews: string
    applications: string
    notifications: string
    security: string
    editorPanel: string
    editorApply: string
    institutionPanel: string
    institutionApply: string
    adminPanel: string
  }
  home: {
    eyebrow: string
    searchPlaceholder: string
    searchHintMobile: string
    searchHint: string
    statsError: string
    approxNote: string
    approxNoteWithJournal: string
    journals: string
    articles: string
    fullText: string
    popularSearches: string
    scopeAll: string
    scopeArticles: string
    scopeAuthors: string
    scopeJournals: string
    recentArticles: string
    recentArticlesDesc: string
    viewAllArticles: string
    featuredJournals: string
    featuredJournalsDesc: string
    topicAreas: string
    personalizedTitle: string
    personalizedDesc: string
    journalsInField: string
    noArticles: string
    noArticlesDesc: string
  }
  search: {
    placeholder: string
    placeholderFull: string
    search: string
    clear: string
    typeArticle: string
    typeJournal: string
    typeAuthor: string
    viewAllResults: string
  }
  article: {
    home: string
    authors: string
    share: string
    journal: string
    year: string
    volume: string
    issue: string
    pages: string
    language: string
    keywords: string
    institution: string
    references: string
    abstractTr: string
    abstractEn: string
    viewPdf: string
    downloadPdf: string
    fullText: string
    articlesInIssue: string
    viewAllInIssue: string
    breadcrumb: string
    untitled: string
    saveArticle: string
    addToList: string
    loginToSave: string
    saved: string
    shareFacebook: string
    shareX: string
    shareLinkedIn: string
    shareWhatsApp: string
  }
  common: {
    loading: string
  }
  journalPage: {
    home: string
    archive: string
    aimScope: string
    editorialBoard: string
    writingRules: string
    contact: string
    recentArticles: string
    noRecentArticles: string
    issues: string
    allArchive: string
    viewAllIssues: string
    aboutJournal: string
    searchInJournal: string
    searchPlaceholder: string
    searchSubmit: string
    latestIssue: string
    quickLinks: string
    archiveAndIssues: string
    issueFallback: string
    publisher: string
    publishLanguage: string
    frequency: string
    startYear: string
    subjectCategory: string
    website: string
    publicationYear: string
    volume: string
    issueNumber: string
    articleCount: string
    articlesLabel: string
    backToArchive: string
    emptySection: string
    viewTurkishPage: string
    trOnlySection: string
    archivePageTitle: string
    archiveIntro: string
    noArchivedIssues: string
    noArticlesInIssue: string
    pagesShort: string
    journalMenu: string
  }
}

export const trMessages: UiMessages = {
  nav: {
    journals: 'Dergiler',
    articles: 'Makaleler',
    authors: 'Yazarlar',
    statistics: 'İstatistikler',
    mainMenu: 'Ana menü',
    openMenu: 'Menüyü aç',
    menu: 'Menü',
    mobileMenu: 'Mobil menü',
  },
  auth: {
    login: 'Giriş',
    loginFull: 'Giriş Yap',
    register: 'Kayıt Ol',
    logout: 'Çıkış yap',
    loggingOut: 'Çıkış…',
    forgotPassword: 'Şifremi Unuttum',
    myAccount: 'Hesabım',
    saved: 'Kaydettiklerim',
    lists: 'Listelerim',
    profile: 'Profilim',
    accountMenu: 'Hesap menüsü',
    userMenu: 'Kullanıcı menüsü',
    loadingSession: 'Oturum yükleniyor',
  },
  footer: {
    tagline:
      'Türkçe ve uluslararası akademik yayınlara güvenilir, açık erişimli keşif ve indeks platformu.',
    explore: 'Keşfet',
    platform: 'Platform',
    account: 'Hesap',
    applications: 'Başvurular',
    corporate: 'Kurumsal Abonelik',
    about: 'Hakkımızda',
    contact: 'İletişim',
    privacy: 'Gizlilik',
    terms: 'Kullanım Koşulları',
    rights: 'Tüm hakları saklıdır.',
  },
  account: {
    title: 'Hesabım',
    navLabel: 'Hesap menüsü',
    overview: 'Genel Bakış',
    savedArticles: 'Kaydedilen Makaleler',
    readingLists: 'Okuma Listelerim',
    followedJournals: 'Takip Ettiğim Dergiler',
    followedAuthors: 'Takip Ettiğim Yazarlar',
    recentViews: 'Son Görüntülediklerim',
    applications: 'Başvuru Merkezi',
    notifications: 'Bildirim Tercihleri',
    security: 'Güvenlik',
    editorPanel: 'Dergi editör paneli',
    editorApply: 'Editör başvurusu',
    institutionPanel: 'Kurum paneli',
    institutionApply: 'Kurum başvurusu',
    adminPanel: 'Yönetim paneli',
  },
  home: {
    eyebrow: 'Akademik arama ve keşif',
    searchPlaceholder: 'Makale, yazar veya anahtar kelime…',
    searchHintMobile: 'Başlık, yazar ve anahtar kelime.',
    searchHint:
      'Arama kapsamı: başlık, yazar ve anahtar kelime. Özet araması sonraki sürümde.',
    statsError: 'Platform istatistikleri geçici olarak yüklenemedi.',
    approxNote: 'yaklaşık sayılar',
    approxNoteWithJournal: 'dergi/makale yaklaşık',
    journals: 'Dergi',
    articles: 'Makale',
    fullText: 'Tam metin',
    popularSearches: 'Popüler aramalar',
    scopeAll: 'Tümü',
    scopeArticles: 'Makaleler',
    scopeAuthors: 'Yazarlar',
    scopeJournals: 'Dergiler',
    recentArticles: 'Son eklenen makaleler',
    recentArticlesDesc: 'Kataloga yeni eklenen akademik yayınlar',
    viewAllArticles: 'Tüm makaleleri görüntüle →',
    featuredJournals: 'Öne çıkan dergiler',
    featuredJournalsDesc: 'Sayfa görüntülenmesine göre',
    topicAreas: 'Konu alanları',
    personalizedTitle: '{category} alanında son eklenen makaleler',
    personalizedDesc: 'İlgi alanınıza göre seçilmiş yeni yayınlar',
    journalsInField: 'Bu alandaki dergiler →',
    noArticles: 'Henüz makale listelenmiyor',
    noArticlesDesc: 'Yeni makaleler eklendiğinde burada görünecek.',
  },
  search: {
    placeholder: 'Ara…',
    placeholderFull: 'Makale, yazar veya anahtar kelime…',
    search: 'Ara',
    clear: 'Temizle',
    typeArticle: 'Makale',
    typeJournal: 'Dergi',
    typeAuthor: 'Yazar',
    viewAllResults: 'tüm sonuçları gör',
  },
  article: {
    home: 'Ana Sayfa',
    authors: 'Yazarlar',
    share: 'Paylaş',
    journal: 'Dergi',
    year: 'Yayın yılı',
    volume: 'Cilt',
    issue: 'Sayı',
    pages: 'Sayfalar',
    language: 'Dil',
    keywords: 'Anahtar kelimeler',
    institution: 'Kurum',
    references: 'Kaynakça',
    abstractTr: 'Özet',
    abstractEn: 'Abstract',
    viewPdf: 'PDF Görüntüle',
    downloadPdf: 'PDF İndir',
    fullText: 'Tam metin',
    articlesInIssue: 'Bu sayıdaki makaleler',
    viewAllInIssue: 'Tüm makaleleri gör',
    breadcrumb: 'Gezinme yolu',
    untitled: 'Başlıksız',
    saveArticle: 'Makaleyi Kaydet',
    addToList: 'Listeme Ekle',
    loginToSave: 'Makaleyi kaydetmek için giriş yapın',
    saved: 'Kaydedildi',
    shareFacebook: "Facebook'ta Paylaş",
    shareX: "X'te Paylaş",
    shareLinkedIn: "LinkedIn'de Paylaş",
    shareWhatsApp: "WhatsApp'ta Paylaş",
  },
  common: {
    loading: 'Yükleniyor…',
  },
  journalPage: {
    home: 'Dergi',
    archive: 'Arşiv',
    aimScope: 'Amaç & Kapsam',
    editorialBoard: 'Editör Kurulu',
    writingRules: 'Yazım Kuralları',
    contact: 'İletişim',
    recentArticles: 'Son makaleler',
    noRecentArticles: 'Bu dergide henüz listelenecek makale bulunmuyor.',
    issues: 'Sayılar',
    allArchive: 'Tüm arşiv',
    viewAllIssues: 'Tüm sayıları gör',
    aboutJournal: 'Dergi hakkında',
    searchInJournal: 'Dergide ara',
    searchPlaceholder: 'Bu dergide ara…',
    searchSubmit: 'Ara',
    latestIssue: 'Son sayı',
    quickLinks: 'Hızlı bağlantılar',
    archiveAndIssues: 'Arşiv ve sayılar',
    issueFallback: 'Sayı',
    publisher: 'Yayıncı',
    publishLanguage: 'Yayın dili',
    frequency: 'Yayın periyodu',
    startYear: 'Başlangıç yılı',
    subjectCategory: 'Konu alanı',
    website: 'Web sitesi',
    publicationYear: 'Yayın yılı',
    volume: 'Cilt',
    issueNumber: 'Sayı',
    articleCount: 'Makale sayısı',
    articlesLabel: 'makale',
    backToArchive: 'Arşive dön',
    emptySection: 'Bu bölüm için içerik henüz eklenmemiş.',
    viewTurkishPage: 'Türkçe sayfayı görüntüle',
    trOnlySection: 'Bu bölüm Türkçe olarak sunulmaktadır.',
    archivePageTitle: '{title} Arşivi',
    archiveIntro: '{title} dergisinin yayımlanmış sayılarını yıllara göre inceleyin.',
    noArchivedIssues: 'Bu dergi için henüz arşivlenmiş sayı bulunmuyor.',
    noArticlesInIssue: 'Bu sayıda listelenecek makale bulunmuyor.',
    pagesShort: 'ss.',
    journalMenu: 'Dergi menüsü',
  },
}

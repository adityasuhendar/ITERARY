export const formatAvailability = (count) => {
  if (count <= 0) return 'Unavailable';
  if (count === 1) return '1 copy';
  return `${count} copies`;
};

export const categories = [
  'All',
  'Fiction',
  'Non-Fiction',
  'Science',
  'Technology',
  'History',
  'Philosophy',
  'Biography',
];

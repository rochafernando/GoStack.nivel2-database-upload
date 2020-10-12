import { getRepository, getCustomRepository, In } from 'typeorm';
import path from 'path';
import fs from 'fs';
import csvParse from 'csv-parse';
import TransactionsRepository from '../repositories/TransactionsRepository';
import uploadConfig from '../config/upload';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  importFilename: string;
}

interface CSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: 'varchar';
}

class ImportTransactionsService {
  async execute({ importFilename }: Request): Promise<Transaction[]> {
    const importFilePath = path.join(uploadConfig.directory, importFilename);

    const readCSVStream = fs.createReadStream(importFilePath);

    const parseStream = csvParse({ from_line: 2, ltrim: true, rtrim: true });

    const parseCSV = readCSVStream.pipe(parseStream);

    const transactions: CSV[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const existentCategories = await categoriesRepository.find({
      where: { title: In(categories) },
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    const addCategoryTiles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTiles.map(title => ({ title })),
    );

    categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(importFilePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
